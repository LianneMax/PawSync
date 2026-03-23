import { Request, Response } from 'express';
import ConfinementRecord from '../models/ConfinementRecord';
import ConfinementMonitoringEntry from '../models/ConfinementMonitoringEntry';
import User from '../models/User';
import Pet from '../models/Pet';
import MedicalRecord from '../models/MedicalRecord';
import { createNotification } from '../services/notificationService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import {
  sendConfinementReleaseRequestToVet,
  sendConfinementReleaseConfirmedToOwner,
} from '../services/emailService';

const MONITORING_POPULATE = [
  { path: 'recorderId', select: 'firstName lastName userType' },
  { path: 'createdBy', select: 'firstName lastName userType' },
  { path: 'updatedBy', select: 'firstName lastName userType' },
  { path: 'alertResolvedBy', select: 'firstName lastName userType' },
];

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const metricOrNull = (value: unknown, unit: string) => {
  const numberValue = toNumberOrNull(value);
  if (numberValue === null) return null;
  return { value: numberValue, unit };
};

async function getRequestingUserClinicId(req: Request): Promise<string | null> {
  if (req.user?.clinicId) return req.user.clinicId;
  if (!req.user?.userId) return null;
  const dbUser = await User.findById(req.user.userId).select('clinicId').lean();
  return (dbUser as any)?.clinicId?.toString() || null;
}

async function canAccessConfinementRecord(req: Request, record: any): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.userType === 'veterinarian') {
    return record.vetId?.toString() === req.user.userId;
  }

  if (req.user.userType === 'clinic-admin') {
    const clinicId = await getRequestingUserClinicId(req);
    return !!clinicId && record.clinicId?.toString() === clinicId;
  }

  return false;
}

/**
 * GET /api/confinement/:id/monitoring
 * Veterinarian/clinic admin — list monitoring entries by confinement record.
 */
export const listConfinementMonitoringEntries = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id).select('petId vetId clinicId status').lean();
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Confinement record not found' });

    const allowed = await canAccessConfinementRecord(req, record);
    if (!allowed) return res.status(403).json({ status: 'ERROR', message: 'Access denied' });

    const { entryType, startDate, endDate, page = '1', limit = '20' } = req.query;
    const query: any = { confinementRecordId: req.params.id };
    if (entryType === 'daily' || entryType === 'spot') {
      query.entryType = entryType;
    }

    const parsedStart = toDateOrNull(startDate);
    const parsedEnd = toDateOrNull(endDate);
    if (parsedStart || parsedEnd) {
      query.recordedAt = {} as Record<string, Date>;
      if (parsedStart) query.recordedAt.$gte = parsedStart;
      if (parsedEnd) query.recordedAt.$lte = parsedEnd;
    }

    const skip = (Math.max(parseInt(String(page), 10), 1) - 1) * Math.max(parseInt(String(limit), 10), 1);

    const [entries, total] = await Promise.all([
      ConfinementMonitoringEntry.find(query)
        .populate(MONITORING_POPULATE)
        .sort({ recordedAt: -1 })
        .skip(skip)
        .limit(Math.max(parseInt(String(limit), 10), 1)),
      ConfinementMonitoringEntry.countDocuments(query),
    ]);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        entries,
        total,
        status: record.status,
      },
    });
  } catch (error) {
    console.error('List confinement monitoring entries error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/confinement/:id/monitoring
 * Veterinarian/clinic admin — create a monitoring entry for active confinement.
 */
export const createConfinementMonitoringEntry = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id).select('petId vetId clinicId status clinicBranchId').lean();
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Confinement record not found' });

    const allowed = await canAccessConfinementRecord(req, record);
    if (!allowed) return res.status(403).json({ status: 'ERROR', message: 'Access denied' });

    if (record.status !== 'admitted') {
      return res.status(400).json({ status: 'ERROR', message: 'Monitoring entries can only be added while confinement is admitted' });
    }

    const entryType = req.body.entryType || 'daily';
    if (req.user.userType === 'clinic-admin' && entryType !== 'spot') {
      return res.status(403).json({ status: 'ERROR', message: 'Clinic admins can only add spot monitoring entries' });
    }

    if (entryType !== 'daily' && entryType !== 'spot') {
      return res.status(400).json({ status: 'ERROR', message: 'entryType must be daily or spot' });
    }

    const requiredFields = ['temperature', 'heartRate', 'weight', 'spo2', 'capillaryRefillTime', 'bodyConditionScore', 'dentalScore', 'clinicalNotes'];
    const missing = requiredFields.find((field) => req.body[field] === undefined || req.body[field] === null || String(req.body[field]).trim() === '');
    if (missing) {
      return res.status(400).json({ status: 'ERROR', message: `${missing} is required` });
    }

    const recordingDate = toDateOrNull(req.body.recordedAt);
    if (req.body.recordedAt && !recordingDate) {
      return res.status(400).json({ status: 'ERROR', message: 'recordedAt is invalid' });
    }

    const entry = await ConfinementMonitoringEntry.create({
      confinementRecordId: req.params.id,
      petId: record.petId,
      medicalRecordId: req.body.medicalRecordId || null,
      recordedAt: recordingDate || new Date(),
      entryType,
      recorderId: req.user.userId,
      recorderRole: req.user.userType,
      temperature: { value: Number(req.body.temperature), unit: '°C' },
      heartRate: { value: Number(req.body.heartRate), unit: 'bpm' },
      respiratoryRate: metricOrNull(req.body.respiratoryRate, 'breaths/min'),
      weight: { value: Number(req.body.weight), unit: 'kg' },
      bodyConditionScore: metricOrNull(req.body.bodyConditionScore, '/5'),
      dentalScore: metricOrNull(req.body.dentalScore, '/3'),
      hydrationStatus: String(req.body.hydrationStatus || '').trim(),
      appetite: String(req.body.appetite || '').trim(),
      painScore: req.body.painScore !== undefined && req.body.painScore !== null && String(req.body.painScore).trim() !== ''
        ? Number(req.body.painScore)
        : null,
      capillaryRefillTime: metricOrNull(req.body.capillaryRefillTime, 'sec'),
      spo2: metricOrNull(req.body.spo2, '%'),
      bloodGlucose: metricOrNull(req.body.bloodGlucose, 'mg/dL'),
      bloodPressureSystolic: metricOrNull(req.body.bloodPressureSystolic, 'mmHg'),
      bloodPressureDiastolic: metricOrNull(req.body.bloodPressureDiastolic, 'mmHg'),
      clinicalNotes: String(req.body.clinicalNotes || '').trim(),
      clinicalFlag: req.body.clinicalFlag || 'normal',
      followUpAction: req.body.followUpAction || 'watch',
      followUpInHours: toNumberOrNull(req.body.followUpInHours),
      requiresImmediateReview: Boolean(req.body.requiresImmediateReview) || req.body.clinicalFlag === 'critical',
      alertResolved: false,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      editReason: String(req.body.editReason || '').trim(),
    });

    const populated = await ConfinementMonitoringEntry.findById(entry._id).populate(MONITORING_POPULATE);

    const isCritical = populated?.clinicalFlag === 'critical' || populated?.requiresImmediateReview;
    if (isCritical) {
      if (record.vetId?.toString() !== req.user.userId) {
        await createNotification(
          record.vetId.toString(),
          'confinement_monitoring_alert',
          'Critical Confinement Monitoring Alert',
          'A critical confinement monitoring entry needs your review.',
          {
            confinementRecordId: req.params.id,
            monitoringEntryId: entry._id,
            petId: record.petId,
          },
        );
      }

      await alertClinicAdmins({
        clinicId: record.clinicId,
        clinicBranchId: (record as any).clinicBranchId || null,
        notificationType: 'confinement_monitoring_alert',
        notificationTitle: 'Critical Confinement Monitoring Alert',
        notificationMessage: 'A confined pet has a critical monitoring entry requiring immediate review.',
        metadata: {
          confinementRecordId: req.params.id,
          monitoringEntryId: entry._id,
          petId: record.petId,
        },
        emailSubject: 'PawSync – Critical Confinement Monitoring Alert',
        emailHeadline: 'Critical Monitoring Entry Logged',
        emailIntro: 'A critical confinement monitoring entry has been recorded and requires attention.',
        emailDetails: {
          'Confinement Record ID': req.params.id,
          'Monitoring Entry ID': entry._id.toString(),
          Flag: populated?.clinicalFlag || 'critical',
          'Recorded At': new Date(populated?.recordedAt || new Date()).toLocaleString('en-US'),
        },
      });
    }

    return res.status(201).json({ status: 'SUCCESS', data: { entry: populated } });
  } catch (error: any) {
    console.error('Create confinement monitoring entry error:', error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PATCH /api/confinement/:id/monitoring/:entryId
 * Veterinarian/clinic admin — update monitoring entry with audit reason.
 */
export const updateConfinementMonitoringEntry = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id).select('vetId clinicId').lean();
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Confinement record not found' });

    const allowed = await canAccessConfinementRecord(req, record);
    if (!allowed) return res.status(403).json({ status: 'ERROR', message: 'Access denied' });

    const entry = await ConfinementMonitoringEntry.findOne({ _id: req.params.entryId, confinementRecordId: req.params.id });
    if (!entry) return res.status(404).json({ status: 'ERROR', message: 'Monitoring entry not found' });

    const editReason = String(req.body.editReason || '').trim();
    if (!editReason) {
      return res.status(400).json({ status: 'ERROR', message: 'editReason is required when updating a monitoring entry' });
    }

    if (req.body.recordedAt !== undefined) {
      const parsedDate = toDateOrNull(req.body.recordedAt);
      if (!parsedDate) return res.status(400).json({ status: 'ERROR', message: 'recordedAt is invalid' });
      entry.recordedAt = parsedDate;
    }
    if (req.body.entryType !== undefined) entry.entryType = req.body.entryType;
    if (req.body.temperature !== undefined) entry.temperature = { value: Number(req.body.temperature), unit: '°C' };
    if (req.body.heartRate !== undefined) entry.heartRate = { value: Number(req.body.heartRate), unit: 'bpm' };
    if (req.body.respiratoryRate !== undefined) entry.respiratoryRate = metricOrNull(req.body.respiratoryRate, 'breaths/min') as any;
    if (req.body.weight !== undefined) entry.weight = { value: Number(req.body.weight), unit: 'kg' };
    if (req.body.bodyConditionScore !== undefined) entry.bodyConditionScore = metricOrNull(req.body.bodyConditionScore, '/5') as any;
    if (req.body.dentalScore !== undefined) entry.dentalScore = metricOrNull(req.body.dentalScore, '/3') as any;
    if (req.body.hydrationStatus !== undefined) entry.hydrationStatus = String(req.body.hydrationStatus || '').trim();
    if (req.body.appetite !== undefined) entry.appetite = String(req.body.appetite || '').trim();
    if (req.body.painScore !== undefined) {
      entry.painScore = req.body.painScore === null || String(req.body.painScore).trim() === ''
        ? null as any
        : Number(req.body.painScore);
    }
    if (req.body.capillaryRefillTime !== undefined) entry.capillaryRefillTime = metricOrNull(req.body.capillaryRefillTime, 'sec');
    if (req.body.spo2 !== undefined) entry.spo2 = metricOrNull(req.body.spo2, '%');
    if (req.body.bloodGlucose !== undefined) entry.bloodGlucose = metricOrNull(req.body.bloodGlucose, 'mg/dL');
    if (req.body.bloodPressureSystolic !== undefined) entry.bloodPressureSystolic = metricOrNull(req.body.bloodPressureSystolic, 'mmHg');
    if (req.body.bloodPressureDiastolic !== undefined) entry.bloodPressureDiastolic = metricOrNull(req.body.bloodPressureDiastolic, 'mmHg');
    if (req.body.clinicalNotes !== undefined) entry.clinicalNotes = String(req.body.clinicalNotes || '').trim();
    if (req.body.clinicalFlag !== undefined) entry.clinicalFlag = req.body.clinicalFlag;
    if (req.body.followUpAction !== undefined) entry.followUpAction = req.body.followUpAction;
    if (req.body.followUpInHours !== undefined) entry.followUpInHours = toNumberOrNull(req.body.followUpInHours);
    if (req.body.requiresImmediateReview !== undefined) entry.requiresImmediateReview = Boolean(req.body.requiresImmediateReview);
    entry.updatedBy = req.user.userId as any;
    entry.editReason = editReason;

    await entry.save();

    const populated = await ConfinementMonitoringEntry.findById(entry._id).populate(MONITORING_POPULATE);

    return res.status(200).json({ status: 'SUCCESS', data: { entry: populated } });
  } catch (error: any) {
    console.error('Update confinement monitoring entry error:', error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PATCH /api/confinement/:id/monitoring/:entryId/resolve-alert
 * Veterinarian — resolve critical monitoring alert.
 */
export const resolveConfinementMonitoringAlert = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    if (req.user.userType !== 'veterinarian') {
      return res.status(403).json({ status: 'ERROR', message: 'Only veterinarians can resolve monitoring alerts' });
    }

    const record = await ConfinementRecord.findById(req.params.id).select('vetId clinicId').lean();
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Confinement record not found' });
    if (record.vetId?.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the handling veterinarian can resolve this alert' });
    }

    const entry = await ConfinementMonitoringEntry.findOne({ _id: req.params.entryId, confinementRecordId: req.params.id });
    if (!entry) return res.status(404).json({ status: 'ERROR', message: 'Monitoring entry not found' });

    entry.alertResolved = true;
    entry.alertResolvedAt = new Date();
    entry.alertResolvedBy = req.user.userId as any;
    entry.updatedBy = req.user.userId as any;
    entry.editReason = String(req.body.editReason || 'Alert reviewed and resolved by veterinarian').trim();
    await entry.save();

    const populated = await ConfinementMonitoringEntry.findById(entry._id).populate(MONITORING_POPULATE);
    return res.status(200).json({ status: 'SUCCESS', data: { entry: populated } });
  } catch (error: any) {
    console.error('Resolve confinement monitoring alert error:', error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/confinement
 * Clinic-admin or vet: list confinement records for their clinic/vet.
 */
export const listConfinementRecords = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const query: any = {};
    if (req.user.userType === 'veterinarian') {
      query.vetId = req.user.userId;
    } else {
      const user = await User.findById(req.user.userId);
      if (user?.clinicId) query.clinicId = user.clinicId;
    }

    const { status } = req.query;
    if (status && status !== 'all') query.status = status;

    const records = await ConfinementRecord.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ admissionDate: -1 });

    return res.status(200).json({ status: 'SUCCESS', data: { records } });
  } catch (error) {
    console.error('List confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/confinement
 * Create a new confinement record.
 */
export const createConfinementRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ status: 'ERROR', message: 'User not found' });

    const { petId, reason, notes, admissionDate, appointmentId, medicalRecordId, billingId } = req.body;
    if (!petId || !reason || !admissionDate) {
      return res.status(400).json({ status: 'ERROR', message: 'petId, reason, and admissionDate are required' });
    }

    const record = new ConfinementRecord({
      petId,
      vetId: req.user.userId,
      clinicId: user.clinicId,
      clinicBranchId: user.clinicBranchId ?? undefined,
      appointmentId: appointmentId ?? undefined,
      medicalRecordIds: medicalRecordId ? [medicalRecordId] : [],
      billingId: billingId ?? null,
      reason,
      notes: notes || '',
      admissionDate: new Date(admissionDate),
      status: 'admitted',
    } as any);
    await record.save();

    await Pet.findByIdAndUpdate(petId, {
      $set: {
        isConfined: true,
        confinedSince: new Date(admissionDate),
        currentConfinementRecordId: record._id,
      },
    });

    if (medicalRecordId) {
      await MedicalRecord.findByIdAndUpdate(medicalRecordId, {
        $set: { confinementRecordId: record._id },
      });
    }

    return res.status(201).json({ status: 'SUCCESS', data: { record } });
  } catch (error) {
    console.error('Create confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PUT /api/confinement/:id
 * Update (discharge or update notes).
 */
export const updateConfinementRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Record not found' });

    const { notes, dischargeDate, status, medicalRecordId, billingId } = req.body;
    if (notes !== undefined) record.notes = notes;
    if (dischargeDate !== undefined) record.dischargeDate = new Date(dischargeDate);
    if (status !== undefined) record.status = status;
    if (billingId !== undefined) (record as any).billingId = billingId;
    if (medicalRecordId) {
      const currentIds = ((record as any).medicalRecordIds || []).map((id: any) => id.toString());
      if (!currentIds.includes(medicalRecordId)) {
        (record as any).medicalRecordIds = [...((record as any).medicalRecordIds || []), medicalRecordId];
      }
    }

    await record.save();

    if (medicalRecordId) {
      await MedicalRecord.findByIdAndUpdate(medicalRecordId, {
        $set: { confinementRecordId: record._id },
      });
    }

    if (status === 'discharged') {
      await Pet.findByIdAndUpdate(record.petId, {
        $set: {
          isConfined: false,
          confinedSince: null,
          currentConfinementRecordId: null,
        },
      });
    }

    if (status === 'admitted') {
      await Pet.findByIdAndUpdate(record.petId, {
        $set: {
          isConfined: true,
          confinedSince: record.admissionDate,
          currentConfinementRecordId: record._id,
        },
      });
    }

    return res.status(200).json({ status: 'SUCCESS', data: { record } });
  } catch (error) {
    console.error('Update confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/confinement/pet/:petId
 * Get confinement history for a specific pet.
 */
export const getConfinementByPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const records = await ConfinementRecord.find({ petId: req.params.petId })
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ admissionDate: -1 });

    return res.status(200).json({ status: 'SUCCESS', data: { records } });
  } catch (error) {
    console.error('Get confinement by pet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/confinement/pet/:petId/request-release
 * Pet owner requests release from confinement for their pet.
 */
export const requestConfinementRelease = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const pet = await Pet.findById(req.params.petId);
    if (!pet) return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });

    if (req.user.userType !== 'pet-owner' || pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the pet owner can request release' });
    }

    if (pet.isLost || pet.status === 'lost') {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot request confinement release while pet is marked as lost' });
    }

    const record = await ConfinementRecord.findOne({
      petId: pet._id,
      status: 'admitted',
    }).sort({ admissionDate: -1 });

    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'No active confinement record found' });
    }

    if ((record as any).releaseRequestStatus === 'pending') {
      return res.status(409).json({ status: 'ERROR', message: 'A release request is already pending confirmation' });
    }

    (record as any).releaseRequestStatus = 'pending';
    (record as any).releaseRequestedByOwnerId = req.user.userId;
    (record as any).releaseRequestedAt = new Date();
    await record.save();

    await createNotification(
      record.vetId.toString(),
      'confinement_release_request',
      'Confinement Release Request',
      `${pet.name}'s owner requested release from confinement. Please confirm discharge.`,
      {
        petId: pet._id,
        confinementRecordId: record._id,
        requestedByOwnerId: req.user.userId,
      }
    );

    Promise.all([
      User.findById(record.vetId).select('firstName email'),
      User.findById(req.user.userId).select('firstName lastName'),
    ]).then(async ([vet, owner]) => {
      if (vet?.email) {
        const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim() || 'Pet Owner';
        sendConfinementReleaseRequestToVet({
          vetEmail: vet.email,
          vetFirstName: vet.firstName,
          ownerName,
          petName: pet.name,
          petId: pet._id.toString(),
          reason: req.body?.reason,
        });
      }
    }).catch((err) => {
      console.error('[Confinement] release request email error:', err);
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Release request sent to the handling veterinarian',
      data: { record },
    });
  } catch (error) {
    console.error('Request confinement release error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PATCH /api/confinement/:id/confirm-release
 * Handling veterinarian confirms release request and discharges confinement.
 */
export const confirmConfinementRelease = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Record not found' });

    if (req.user.userType !== 'veterinarian' || record.vetId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the handling veterinarian can confirm release' });
    }

    if ((record as any).releaseRequestStatus !== 'pending') {
      return res.status(400).json({ status: 'ERROR', message: 'No pending release request to confirm' });
    }

    const now = new Date();
    record.status = 'discharged';
    record.dischargeDate = now;
    (record as any).releaseRequestStatus = 'approved';
    (record as any).releaseConfirmedByVetId = req.user.userId;
    (record as any).releaseConfirmedAt = now;
    await record.save();

    const pet = await Pet.findById(record.petId);
    if (pet) {
      if (pet.isLost || pet.status === 'lost') {
        return res.status(400).json({ status: 'ERROR', message: 'Cannot release confinement while pet is marked as lost' });
      }

      pet.isConfined = false;
      pet.confinedSince = null;
      (pet as any).currentConfinementRecordId = null;
      await pet.save();
    }

    if ((record as any).releaseRequestedByOwnerId) {
      await createNotification(
        (record as any).releaseRequestedByOwnerId.toString(),
        'confinement_release_confirmed',
        'Confinement Release Confirmed',
        `${pet?.name || 'Your pet'} has been discharged from confinement by the veterinarian.`,
        {
          petId: pet?._id,
          confinementRecordId: record._id,
          confirmedByVetId: req.user.userId,
        }
      );

      Promise.all([
        User.findById((record as any).releaseRequestedByOwnerId).select('firstName email'),
        User.findById(req.user.userId).select('firstName lastName'),
      ]).then(async ([owner, vet]) => {
        if (owner?.email) {
          const vetName = [vet?.firstName, vet?.lastName].filter(Boolean).join(' ').trim() || 'Veterinarian';
          sendConfinementReleaseConfirmedToOwner({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet?.name || 'Your pet',
            petId: pet?._id?.toString() || record.petId.toString(),
            vetName,
          });
        }
      }).catch((err) => {
        console.error('[Confinement] release confirmation email error:', err);
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Confinement released and marked as discharged',
      data: { record },
    });
  } catch (error) {
    console.error('Confirm confinement release error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
