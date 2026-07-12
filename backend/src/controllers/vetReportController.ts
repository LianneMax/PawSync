import { Request, Response } from 'express';
import VetReport from '../models/VetReport';
import MedicalRecord from '../models/MedicalRecord';
import ConfinementRecord from '../models/ConfinementRecord';
import ConfinementMonitoringEntry from '../models/ConfinementMonitoringEntry';
import Pet from '../models/Pet';
import PetNotes from '../models/PetNotes';
import User from '../models/User';
import Vaccination from '../models/Vaccination';
import { createNotification } from '../services/notificationService';
import { sendVetReportShared } from '../services/emailService';
import {
  generateReportSections,
  humanizeReportSections,
  isAIConfigured,
  ReportGenerationError,
} from '../services/vetReportGenerationService';
import type { ReportType } from '../models/VetReport';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const VALID_REPORT_TYPES: ReportType[] = [
  'general', 'soap', 'diagnostic', 'surgery', 'healthCertificate', 'dischargeSummary', 'referralLetter', 'confinement',
];

// Post-creation "update with new visits" behavior for these types is still to be decided,
// so sync-records stays disabled for them. Creation with multiple records IS supported —
// their prompt builders handle any number of visits.
// 'confinement' is always disabled here: its record set is derived live from
// ConfinementRecord.medicalRecordIds on every /generate call, so there is nothing to sync.
const SYNC_DISABLED_REPORT_TYPES: ReportType[] = ['soap', 'surgery', 'dischargeSummary', 'confinement'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveReportRecordIds(report: any): string[] {
  const ids: string[] = (report.medicalRecordIds || []).map((id: any) =>
    typeof id === 'object' && id?._id ? id._id.toString() : id.toString()
  );
  if (ids.length === 0 && report.medicalRecordId) {
    const legacy = report.medicalRecordId;
    ids.push(typeof legacy === 'object' && legacy?._id ? legacy._id.toString() : legacy.toString());
  }
  return ids;
}

// A completed record is "report-ready" only when any emergency-deferred documentation
// (vitals/SOAP skipped during triage) has been backfilled. Keeps hollow emergency
// records out of the report pipeline without touching the emergency flow itself.
const REPORT_READY_FILTER = {
  $or: [
    { 'emergencyCase.isEmergency': { $ne: true } },
    { 'emergencyCase.deferredFields': { $exists: false } },
    { 'emergencyCase.deferredFields': { $size: 0 } },
    { 'emergencyCase.completedDeferredAt': { $ne: null } },
  ],
};

async function findCompletedRecordIdsForPet(petId: any): Promise<string[]> {
  const records = await MedicalRecord.find({ petId, stage: 'completed', ...REPORT_READY_FILTER })
    .select('_id')
    .lean();
  return records.map((r: any) => r._id.toString());
}

async function fetchMonitoringEntries(report: any): Promise<any[] | undefined> {
  if (report.reportType !== 'confinement' || !report.confinementRecordId) return undefined;
  const confinementRecordId = typeof report.confinementRecordId === 'object' && report.confinementRecordId?._id
    ? report.confinementRecordId._id
    : report.confinementRecordId;
  return ConfinementMonitoringEntry.find({ confinementRecordId })
    .sort({ recordedAt: 1 })
    .lean();
}

async function countNewRecords(report: any): Promise<number> {
  const includedIds = resolveReportRecordIds(report);
  const since = report.recordsSyncedAt || report.createdAt;
  return MedicalRecord.countDocuments({
    petId: typeof report.petId === 'object' && report.petId?._id ? report.petId._id : report.petId,
    stage: 'completed',
    ...REPORT_READY_FILTER,
    _id: { $nin: includedIds },
    createdAt: { $gt: since },
  });
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createReport = async (req: Request, res: Response) => {
  try {
    const { petId, medicalRecordId, title, reportDate, vetContextNotes, scope, reportType, confinementRecordId } = req.body;
    const user = req.user!;

    if (!petId) {
      return res.status(400).json({ status: 'ERROR', message: 'petId is required' });
    }

    const validatedReportType: ReportType = VALID_REPORT_TYPES.includes(reportType) ? reportType : 'general';

    // Confinement reports aren't built from a free record selection: the vet picks the
    // confinement stay and the record set is derived from it, so this branches before
    // the generic scope/selection logic below.
    if (validatedReportType === 'confinement') {
      if (!confinementRecordId) {
        return res.status(400).json({ status: 'ERROR', message: 'confinementRecordId is required for confinement reports.' });
      }
      const confinementRecord = await ConfinementRecord.findOne({ _id: confinementRecordId, petId }).lean() as any;
      if (!confinementRecord) {
        return res.status(400).json({ status: 'ERROR', message: 'Confinement record not found for this pet.' });
      }

      const existing = await VetReport.findOne({ petId, reportType: 'confinement', confinementRecordId }).select('_id').lean();
      if (existing) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A confinement report already exists for this stay. Update that report instead of creating a duplicate.',
          existingReportId: (existing as any)._id,
        });
      }

      const recordIds = (confinementRecord.medicalRecordIds || []).map((id: any) => id.toString());

      let clinicId = user.clinicId || confinementRecord.clinicId;
      let clinicBranchId = user.clinicBranchId || confinementRecord.clinicBranchId;
      if (!clinicId || !clinicBranchId) {
        const vetUser = await User.findById(user.userId).lean() as any;
        if (vetUser) {
          clinicId = clinicId || vetUser.clinicId;
          clinicBranchId = clinicBranchId || vetUser.clinicBranchId;
        }
      }
      if (!clinicId || !clinicBranchId) {
        return res.status(400).json({ status: 'ERROR', message: 'Unable to determine clinic for this report. Please contact support.' });
      }

      const report = await VetReport.create({
        petId,
        medicalRecordId: (recordIds.length === 1 ? recordIds[0] : null) as any,
        medicalRecordIds: recordIds as any,
        confinementRecordId,
        scope: 'selected',
        recordsSyncedAt: new Date(),
        reportType: 'confinement',
        vetId: user.userId,
        clinicId,
        clinicBranchId,
        title: title || '',
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        vetContextNotes: vetContextNotes || '',
        sections: {},
      });

      return res.status(201).json({ status: 'OK', data: report });
    }

    const reportScope: 'selected' | 'all' = scope === 'all' ? 'all' : 'selected';

    let recordIds: string[] = [];
    if (reportScope === 'all') {
      recordIds = await findCompletedRecordIdsForPet(petId);
      if (recordIds.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'This pet has no completed medical records yet.' });
      }
    } else {
      const requested: string[] = Array.isArray(req.body.medicalRecordIds)
        ? req.body.medicalRecordIds.map(String)
        : medicalRecordId
          ? [String(medicalRecordId)]
          : [];
      if (requested.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'Select at least one medical record for the report.' });
      }
      const unique = [...new Set(requested)];
      const found = await MedicalRecord.find({ _id: { $in: unique }, petId, stage: 'completed', ...REPORT_READY_FILTER })
        .select('_id')
        .lean();
      if (found.length !== unique.length) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'One or more selected records do not belong to this pet or are not completed.',
        });
      }
      recordIds = unique;
    }

    // Multiple reports per medical record are allowed (e.g. a SOAP note and a discharge
    // summary for the same visit), but an exact duplicate — same type covering the same
    // record set — is not. 'all'-scope reports auto-cover everything, so one per type per pet.
    if (reportScope === 'all') {
      const existing = await VetReport.findOne({ petId, reportType: validatedReportType, scope: 'all' })
        .select('_id')
        .lean();
      if (existing) {
        return res.status(409).json({
          status: 'ERROR',
          message: `A${validatedReportType === 'general' ? ' general' : ''} report covering all records already exists for this pet. Update that report instead of creating a duplicate.`,
          existingReportId: (existing as any)._id,
        });
      }
    } else {
      const candidates = await VetReport.find({ petId, reportType: validatedReportType })
        .select('medicalRecordId medicalRecordIds scope')
        .lean();
      const targetSet = [...recordIds].sort().join(',');
      const duplicate = candidates.find((c: any) => {
        if (c.scope === 'all') return false; // compared above only when creating 'all'
        const ids: string[] = (c.medicalRecordIds?.length
          ? c.medicalRecordIds
          : c.medicalRecordId ? [c.medicalRecordId] : []
        ).map(String);
        return ids.sort().join(',') === targetSet;
      });
      if (duplicate) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A report of this type already exists for exactly these medical records.',
          existingReportId: (duplicate as any)._id,
        });
      }
    }

    const isSingleRecordReport = reportScope === 'selected' && recordIds.length === 1;

    let clinicId = user.clinicId;
    let clinicBranchId = user.clinicBranchId;

    if (!clinicId || !clinicBranchId) {
      const mr = await MedicalRecord.findById(recordIds[0]).lean() as any;
      if (mr) {
        clinicId = clinicId || mr.clinicId;
        clinicBranchId = clinicBranchId || mr.clinicBranchId;
      }
    }

    if (!clinicId || !clinicBranchId) {
      const vetUser = await User.findById(user.userId).lean() as any;
      if (vetUser) {
        clinicId = clinicId || vetUser.clinicId;
        clinicBranchId = clinicBranchId || vetUser.clinicBranchId;
      }
    }

    if (!clinicId || !clinicBranchId) {
      return res.status(400).json({ status: 'ERROR', message: 'Unable to determine clinic for this report. Please contact support.' });
    }

    const report = await VetReport.create({
      petId,
      medicalRecordId: (isSingleRecordReport ? recordIds[0] : null) as any,
      medicalRecordIds: recordIds as any,
      scope: reportScope,
      recordsSyncedAt: new Date(),
      reportType: validatedReportType,
      vetId: user.userId,
      clinicId,
      clinicBranchId,
      title: title || '',
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      vetContextNotes: vetContextNotes || '',
      sections: {},
    });

    res.status(201).json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const listReports = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { petId, limit = '20', offset = '0', search, types, status } = req.query;

    const filter: Record<string, any> = {};
    if (user.userType === 'veterinarian') {
      filter.vetId = user.userId;
    } else {
      filter.clinicId = user.clinicId;
    }
    if (petId) filter.petId = petId;

    // Status filter: ?status=draft|finalized|shared. Mirrors the list badge logic,
    // where a shared report shows as Shared regardless of draft/finalized status.
    if (typeof status === 'string' && status.trim()) {
      if (status === 'shared') {
        filter.sharedWithOwner = true;
      } else if (status === 'finalized' || status === 'draft') {
        filter.status = status;
        filter.sharedWithOwner = { $ne: true };
      }
    }

    // Multi-select report type filter: ?types=soap,diagnostic
    if (typeof types === 'string' && types.trim()) {
      const requested = types.split(',').map((t) => t.trim()).filter((t) => VALID_REPORT_TYPES.includes(t as ReportType));
      if (requested.length > 0) filter.reportType = { $in: requested };
    }

    // Free-text search across report title, pet name, and owner name
    if (typeof search === 'string' && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      const matchingOwners = await User.find({ $or: [{ firstName: rx }, { lastName: rx }] }).select('_id').lean();
      const ownerIds = matchingOwners.map((o: any) => o._id);
      const matchingPets = await Pet.find({
        $or: [{ name: rx }, ...(ownerIds.length ? [{ ownerId: { $in: ownerIds } }] : [])],
      }).select('_id').lean();
      const petIds = matchingPets.map((p: any) => p._id);
      filter.$or = [{ title: rx }, ...(petIds.length ? [{ petId: { $in: petIds } }] : [])];
    }

    const total = await VetReport.countDocuments(filter);
    const reports = await VetReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .populate({
        path: 'petId',
        select: 'name species breed photo ownerId',
        populate: { path: 'ownerId', select: 'firstName lastName' },
      })
      .populate('vetId', 'firstName lastName')
      .lean();

    res.json({ status: 'OK', data: reports, total });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────

export const getReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id)
      .populate('petId', 'name species breed sex dateOfBirth weight photo allergies sterilization microchipNumber')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
      .populate('medicalRecordId')
      .populate('medicalRecordIds', 'chiefComplaint createdAt stage vitals diagnosticTests medications preventiveCare surgeryRecord overallObservation assessment immunityTesting')
      .populate('confinementRecordId', 'reason notes admissionDate dischargeDate status')
      .populate('addenda.addedBy', 'firstName lastName')
      .lean();

    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    const petId = typeof (report as any).petId === 'object' ? (report as any).petId._id : (report as any).petId;
    const [newRecordCount, vaccinations, monitoringEntries] = await Promise.all([
      countNewRecords(report),
      Vaccination.find({ petId }).sort({ dateAdministered: 1 }).select('vaccineName dateAdministered nextDueDate doseNumber boosterNumber status manufacturer notes').lean(),
      fetchMonitoringEntries(report),
    ]);
    res.json({ status: 'OK', data: { ...report, newRecordCount, vaccinations, monitoringEntries } });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── PUBLIC / SHARED ─────────────────────────────────────────────────────────

export const getSharedReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findOne({ _id: id, sharedWithOwner: true })
      .populate('petId', 'name species breed sex dateOfBirth weight photo allergies sterilization microchipNumber')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
      .populate('medicalRecordIds', 'chiefComplaint createdAt stage vitals diagnosticTests medications preventiveCare surgeryRecord overallObservation assessment immunityTesting')
      .populate('confinementRecordId', 'reason notes admissionDate dischargeDate status')
      .populate('addenda.addedBy', 'firstName lastName')
      .lean();

    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found or not shared' });
    }

    const petId = typeof (report as any).petId === 'object' ? (report as any).petId._id : (report as any).petId;
    const [vaccinations, monitoringEntries] = await Promise.all([
      Vaccination.find({ petId }).sort({ dateAdministered: 1 }).select('vaccineName dateAdministered nextDueDate doseNumber boosterNumber status manufacturer notes').lean(),
      fetchMonitoringEntries(report),
    ]);
    res.json({ status: 'OK', data: { ...report, vaccinations, monitoringEntries } });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export const updateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, reportDate, vetContextNotes, sections, status, vetSignature } = req.body;

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Finalized reports are locked. Until shared they may be reverted to draft
    // (unfinalized) to make corrections; once shared with the owner they are
    // permanently immutable. (Owner summary generation goes through /humanize.)
    if (report.status === 'finalized') {
      const wantsUnfinalize = status === 'draft';
      if (wantsUnfinalize && !report.sharedWithOwner) {
        report.status = 'draft';
        await report.save();
        return res.json({ status: 'OK', data: report });
      }
      return res.status(400).json({
        status: 'ERROR',
        message: report.sharedWithOwner
          ? 'This report has been shared with the owner and can no longer be edited or reverted to draft.'
          : 'This report is finalized and can no longer be edited. Revert it to draft to make changes.',
      });
    }

    // Finalization gates: a report must have content and a signature before it can be
    // finalized — once finalized it can no longer be deleted, so validate up front.
    if (status === 'finalized') {
      const mergedSections = sections
        ? { ...(report.sections as any), ...sections }
        : (report.sections as any);
      const hasContent = Object.values(mergedSections || {}).some(
        (v) => typeof v === 'string' && v.trim().length > 0
      );
      if (!hasContent) {
        return res.status(400).json({ status: 'ERROR', message: 'Cannot finalize a blank report. Generate or write the report content first.' });
      }
      const effectiveSignature = vetSignature !== undefined ? vetSignature : report.vetSignature;
      if (!effectiveSignature?.url) {
        return res.status(400).json({ status: 'ERROR', message: 'The report must be signed before it can be finalized.' });
      }
    }

    if (title !== undefined) report.title = title;
    if (reportDate !== undefined) report.reportDate = new Date(reportDate);
    if (vetContextNotes !== undefined) report.vetContextNotes = vetContextNotes;
    if (status !== undefined) report.status = status;
    if (vetSignature !== undefined) report.vetSignature = vetSignature;
    if (sections) {
      report.sections = { ...(report.sections as any), ...sections };
      report.markModified('sections');
    }

    await report.save();
    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── DELETE (drafts only) ─────────────────────────────────────────────────────

/**
 * DELETE /vet-reports/:id
 * Finalized reports are medico-legal documents and can never be deleted —
 * only drafts that were never shared with the owner can be removed.
 */
export const deleteReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }
    if (report.status !== 'draft') {
      return res.status(400).json({ status: 'ERROR', message: 'Finalized reports cannot be deleted.' });
    }
    if (report.sharedWithOwner) {
      return res.status(400).json({ status: 'ERROR', message: 'Unshare the report from the owner before deleting it.' });
    }

    await report.deleteOne();
    res.json({ status: 'OK', message: 'Report deleted' });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── SYNC RECORDS ─────────────────────────────────────────────────────────────

export const syncReportRecords = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Finalized reports are locked: new visits go into a new report instead.
    if (report.status === 'finalized') {
      return res.status(400).json({ status: 'ERROR', message: 'This report is finalized and can no longer be updated with new visits. Create a new report instead.' });
    }

    // Update-with-new-visits behavior for these types is still to be decided — disabled for now.
    if (SYNC_DISABLED_REPORT_TYPES.includes((report.reportType as ReportType) || 'general')) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Updating this report type with additional records is not supported yet. Create a new report for the new visit instead.',
      });
    }

    const currentIds = resolveReportRecordIds(report);
    let nextIds: string[];

    if (report.scope === 'all') {
      nextIds = await findCompletedRecordIdsForPet(report.petId);
    } else if (req.body.addNew === true) {
      const since = report.recordsSyncedAt || report.createdAt;
      const newRecords = await MedicalRecord.find({
        petId: report.petId,
        stage: 'completed',
        ...REPORT_READY_FILTER,
        _id: { $nin: currentIds },
        createdAt: { $gt: since },
      })
        .select('_id')
        .lean();
      nextIds = [...currentIds, ...newRecords.map((r: any) => r._id.toString())];
    } else {
      const addRecordIds: string[] = Array.isArray(req.body.addRecordIds)
        ? req.body.addRecordIds.map(String)
        : [];
      if (addRecordIds.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'addRecordIds (or addNew: true) is required for selected-scope reports.' });
      }
      const unique = [...new Set(addRecordIds)].filter((rid) => !currentIds.includes(rid));
      if (unique.length > 0) {
        const found = await MedicalRecord.find({ _id: { $in: unique }, petId: report.petId, stage: 'completed', ...REPORT_READY_FILTER })
          .select('_id')
          .lean();
        if (found.length !== unique.length) {
          return res.status(400).json({
            status: 'ERROR',
            message: 'One or more records do not belong to this pet or are not completed.',
          });
        }
      }
      nextIds = [...currentIds, ...unique];
    }

    const added = nextIds.filter((rid) => !currentIds.includes(rid));

    report.medicalRecordIds = nextIds as any;
    report.recordsSyncedAt = new Date();
    if (added.length > 0) {
      report.ownerSummary = null;
    }
    await report.save();

    res.json({ status: 'OK', data: report, addedCount: added.length });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── SHARE ────────────────────────────────────────────────────────────────────

export const shareReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shared } = req.body;

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Only finalized reports may be shared with the owner
    if (shared && report.status !== 'finalized') {
      return res.status(400).json({ status: 'ERROR', message: 'Finalize the report before sharing it with the owner.' });
    }

    // Owners are shown the plain-language summary first, so every text section must be
    // filled before sharing — a blank section reads as a gap to the owner. treatmentPlan
    // is intentionally optional (empty for medication-less reports). ownerSummary is a
    // Mongoose subdocument, so read its typed fields directly — Object.values on the subdoc
    // returns internal Mongoose props, not the text fields.
    if (shared) {
      const os = report.ownerSummary;
      const complete = !!os &&
        [os.whatWeFound, os.testResultsExplained, os.whatsHappeningInTheirBody,
         os.theDiagnosis, os.theTreatmentPlan, os.whatToExpect]
          .every((v) => typeof v === 'string' && v.trim().length > 0);
      if (!complete) {
        return res.status(400).json({ status: 'ERROR', message: 'Complete every section of the owner summary before sharing the report with the owner.' });
      }
    }

    // Sharing is one-way: once the owner has been given access it cannot be revoked
    if (!shared && report.sharedWithOwner) {
      return res.status(400).json({ status: 'ERROR', message: 'This report has been shared with the owner and can no longer be unshared.' });
    }

    const wasAlreadyShared = report.sharedWithOwner;
    report.sharedWithOwner = !!shared;
    report.sharedAt = shared ? new Date() : undefined;
    await report.save();

    if (shared && !wasAlreadyShared) {
      try {
        const [pet, vet, clinic] = await Promise.all([
          Pet.findById(report.petId).lean() as any,
          User.findById(report.vetId).select('firstName lastName').lean() as any,
          report.clinicId
            ? (await import('../models/Clinic')).default.findById(report.clinicId).select('name').lean() as any
            : null,
        ]);

        const owner = pet?.ownerId
          ? await User.findById(pet.ownerId).select('email firstName _id').lean() as any
          : null;

        const reportUrl = `${FRONTEND_URL}/reports/${id}`;

        if (owner?.email) {
          sendVetReportShared({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName || 'Pet Owner',
            petName: pet?.name || 'your pet',
            vetName: vet ? `${vet.firstName} ${vet.lastName}` : 'the veterinarian',
            clinicName: clinic?.name || 'the clinic',
            reportDate: report.reportDate,
            reportUrl,
          });
        }

        if (owner?._id) {
          await createNotification(
            owner._id.toString(),
            'medical_record_shared',
            'Diagnostic Report Available',
            `Dr. ${vet ? `${vet.firstName} ${vet.lastName}` : 'your veterinarian'} has shared a diagnostic report for ${pet?.name || 'your pet'}.`,
            { vetReportId: id },
          );
        }
      } catch (notifyErr) {
        console.error('[VetReport] Share notification failed:', notifyErr);
      }
    }

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── LIST SHARED (owner) ──────────────────────────────────────────────────────

export const listSharedReportsForOwner = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;
    const reports = await VetReport.find({ petId, sharedWithOwner: true })
      .sort({ reportDate: -1 })
      .populate('vetId', 'firstName lastName')
      .lean();
    res.json({ status: 'OK', data: reports });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── AI GENERATE ─────────────────────────────────────────────────────────────

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isAIConfigured()) {
      return res.status(503).json({ status: 'ERROR', message: 'OpenAI API key not configured' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Finalized reports are locked: regenerating would overwrite the signed content.
    if (report.status === 'finalized') {
      return res.status(400).json({ status: 'ERROR', message: 'This report is finalized and can no longer be regenerated.' });
    }

    const pet = await Pet.findById(report.petId).lean();
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const vet = await User.findById(report.vetId).lean() as any;

    const recordIds = resolveReportRecordIds(report);
    const [records, petNotesDoc] = await Promise.all([
      recordIds.length > 0
        ? MedicalRecord.find({ _id: { $in: recordIds } }).sort({ createdAt: 1 }).lean()
        : Promise.resolve([] as any[]),
      PetNotes.findOne({ petId: report.petId }).lean() as any,
    ]);

    const persistentNotes = petNotesDoc?.notes || '';
    const contextNotes = report.vetContextNotes;
    const rType = (report.reportType as ReportType) || 'general';

    let vaccinations: any[] | undefined;
    if (rType === 'referralLetter' || rType === 'general') {
      vaccinations = await Vaccination.find({ petId: report.petId })
        .sort({ dateAdministered: 1 })
        .select('vaccineName dateAdministered nextDueDate doseNumber boosterNumber status')
        .lean();
    }

    let confinementRecord: any;
    let monitoringEntries: any[] | undefined;
    if (rType === 'confinement') {
      if (!report.confinementRecordId) {
        return res.status(400).json({ status: 'ERROR', message: 'This report has no linked confinement stay.' });
      }
      confinementRecord = await ConfinementRecord.findById(report.confinementRecordId).lean();
      if (!confinementRecord) {
        return res.status(404).json({ status: 'ERROR', message: 'Linked confinement record no longer exists.' });
      }
      monitoringEntries = await ConfinementMonitoringEntry.find({ confinementRecordId: report.confinementRecordId })
        .sort({ recordedAt: 1 })
        .lean();
    }

    const sections = await generateReportSections({
      reportType: rType,
      pet,
      vet,
      records,
      vetContextNotes: contextNotes,
      persistentNotes,
      vaccinations,
      confinementRecord,
      monitoringEntries,
    });

    report.sections = sections;
    report.markModified('sections');
    report.isAIGenerated = true;
    report.ownerSummary = null;
    await report.save();

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    if (err instanceof ReportGenerationError) {
      return res.status(502).json({
        status: 'ERROR',
        message: err.message,
        raw: err.raw,
      });
    }

    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── ADDENDUM ─────────────────────────────────────────────────────────────────

/**
 * POST /vet-reports/:id/addenda
 * Finalized reports are frozen snapshots — a data fix discovered later (e.g. a medical
 * record corrected after the report was shared and signed) is appended as an addendum
 * instead of mutating the original content, so the shared/signed document never changes
 * retroactively. Only allowed once the report is finalized; unfinalized drafts should be
 * edited directly.
 */
export const addReportAddendum = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const user = req.user!;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Addendum text is required.' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    if (report.status !== 'finalized') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Addenda can only be added to finalized reports. Edit the report directly instead.',
      });
    }

    report.addenda.push({ text: text.trim(), addedBy: user.userId, addedAt: new Date() } as any);
    await report.save();

    const populated = await VetReport.findById(id).populate('addenda.addedBy', 'firstName lastName').lean();

    if (report.sharedWithOwner) {
      try {
        const pet = await Pet.findById(report.petId).lean() as any;
        const vet = await User.findById(report.vetId).select('firstName lastName').lean() as any;
        const owner = pet?.ownerId ? await User.findById(pet.ownerId).select('_id').lean() as any : null;

        if (owner?._id) {
          await createNotification(
            owner._id.toString(),
            'medical_record_shared',
            'Report Updated with an Addendum',
            `Dr. ${vet ? `${vet.firstName} ${vet.lastName}` : 'your veterinarian'} added a correction to a diagnostic report for ${pet?.name || 'your pet'}.`,
            { vetReportId: id },
          );
        }
      } catch (notifyErr) {
        console.error('[VetReport] Addendum notification failed:', notifyErr);
      }
    }

    res.status(201).json({ status: 'OK', data: populated });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── AI HUMANIZE (owner summary) ─────────────────────────────────────────────

export const humanizeReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isAIConfigured()) {
      return res.status(503).json({ status: 'ERROR', message: 'OpenAI API key not configured' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    if (report.status !== 'finalized') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'The report must be finalized before generating an owner summary.',
      });
    }

    // Once shared, the report (and its owner summary) is a frozen snapshot the owner has seen
    if (report.sharedWithOwner) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'This report has been shared with the owner and its summary can no longer be regenerated.',
      });
    }

    const pet = await Pet.findById(report.petId).lean() as any;
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const petType = pet.species === 'canine' ? 'dog' : 'cat';

    // Load the linked records so the treatment plan is built from REAL medications
    // (accurate dose/dates/status) rather than re-parsed from the AI narrative.
    const recordIds = resolveReportRecordIds(report);
    const records = recordIds.length > 0
      ? await MedicalRecord.find({ _id: { $in: recordIds } }).sort({ createdAt: 1 }).lean() as any[]
      : [];

    // Flatten every prescription across visits, tagging each with its owning visit date.
    const structuredMeds = records.flatMap((r: any) =>
      (r.medications || []).map((m: any) => ({
        name: m.name ?? '',
        dosage: m.dosage ?? '',
        route: m.route ?? '',
        frequency: m.frequency ?? '',
        duration: m.duration ?? '',
        startDate: m.startDate ?? null,
        endDate: m.endDate ?? null,
        visitDate: r.createdAt ?? null,
        status: m.status ?? '',
      }))
    );

    const summary = await humanizeReportSections(
      report.sections,
      pet.name,
      petType,
      structuredMeds.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        route: m.route,
        frequency: m.frequency,
        duration: m.duration,
        endDate: m.endDate ? new Date(m.endDate).toISOString() : null,
      })),
      report.reportDate ? new Date(report.reportDate).toISOString() : null
    );

    // Merge: clinical columns come only from the record; whatItDoes is the AI blurb,
    // matched by exact name (first unused match), falling back to positional order.
    const blurbs = summary.treatments.slice();
    const takeBlurb = (name: string): string => {
      const i = blurbs.findIndex((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (i !== -1) return blurbs.splice(i, 1)[0].whatItDoes;
      return blurbs.length ? blurbs.shift()!.whatItDoes : '';
    };

    const treatmentPlan = structuredMeds
      .map((m) => ({ ...m, whatItDoes: takeBlurb(m.name) }))
      .sort((a, b) => {
        const at = new Date(a.startDate ?? a.visitDate ?? 0).getTime();
        const bt = new Date(b.startDate ?? b.visitDate ?? 0).getTime();
        return at - bt;
      });

    report.ownerSummary = {
      whatWeFound: summary.whatWeFound ?? '',
      testResultsExplained: summary.testResultsExplained ?? '',
      whatsHappeningInTheirBody: summary.whatsHappeningInTheirBody ?? '',
      theDiagnosis: summary.theDiagnosis ?? '',
      theTreatmentPlan: summary.theTreatmentPlan ?? '',
      whatToExpect: summary.whatToExpect ?? '',
      treatmentPlan: treatmentPlan as any,
    };
    report.markModified('ownerSummary');
    await report.save();

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    if (err instanceof ReportGenerationError) {
      return res.status(502).json({
        status: 'ERROR',
        message: err.message,
        raw: err.raw,
      });
    }

    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── UPDATE OWNER SUMMARY ────────────────────────────────────────────────────

const OWNER_SUMMARY_FIELDS = [
  'whatWeFound',
  'testResultsExplained',
  'whatsHappeningInTheirBody',
  'theDiagnosis',
  'theTreatmentPlan',
  'whatToExpect',
] as const;

/**
 * PATCH /vet-reports/:id/owner-summary
 * The owner summary is an AI-drafted explanatory layer over the finalized report,
 * so — unlike `sections` — the vet may still edit it after finalization (matching
 * /humanize, which also runs post-finalize). A summary must already exist;
 * generation goes through /humanize.
 */
export const updateOwnerSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ownerSummary } = req.body;

    if (!ownerSummary || typeof ownerSummary !== 'object' || Array.isArray(ownerSummary)) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerSummary object is required.' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    if (report.status !== 'finalized') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'The report must be finalized before its owner summary can be edited.',
      });
    }

    // Once shared, the owner summary is locked — the owner already has this version
    if (report.sharedWithOwner) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'This report has been shared with the owner and its summary can no longer be edited.',
      });
    }

    if (!report.ownerSummary) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Generate an owner summary before editing it.',
      });
    }

    for (const field of OWNER_SUMMARY_FIELDS) {
      const value = (ownerSummary as Record<string, unknown>)[field];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        return res.status(400).json({ status: 'ERROR', message: `${field} must be a string.` });
      }
      (report.ownerSummary as any)[field] = value;
    }

    // Treatment plan: only `whatItDoes` is owner-editable. Clinical columns (dose, dates,
    // status) are authoritative from the record, so we keep the stored values and update
    // just the explanation, matching incoming rows to stored rows positionally.
    const incomingPlan = (ownerSummary as Record<string, unknown>).treatmentPlan;
    if (Array.isArray(incomingPlan)) {
      const stored = (report.ownerSummary as any).treatmentPlan;
      if (Array.isArray(stored)) {
        incomingPlan.forEach((item: any, i: number) => {
          if (stored[i] && item && typeof item.whatItDoes === 'string') {
            stored[i].whatItDoes = item.whatItDoes;
          }
        });
      }
    }

    report.markModified('ownerSummary');
    await report.save();

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    if (err instanceof ReportGenerationError) {
      return res.status(502).json({
        status: 'ERROR',
        message: err.message,
        raw: err.raw,
      });
    }

    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};
