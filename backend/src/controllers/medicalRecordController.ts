import { Request, Response } from 'express';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import AssignedVet from '../models/AssignedVet';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import Billing from '../models/Billing';
import ConfinementRecord from '../models/ConfinementRecord';
import ProductService from '../models/ProductService';
import VaccineType from '../models/VaccineType';
import { createNotification } from '../services/notificationService';
import { sendBillingPendingPayment } from '../services/emailService';
import { getPregnancySnapshot, syncPregnancyFromMedicalRecord, getPregnancyEpisodeHistory } from '../services/pregnancyDomainService';
import type { PregnancyEvidenceSource } from '../models/PregnancyEvidence';

/**
 * Helper — returns true if req.user is a clinic-admin or clinic-admin.
 */
function isClinicAdminUser(req: Request): boolean {
  return req.user?.userType === 'clinic-admin';
}

/**
 * Helper — add days to a date, returns a new Date.
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Helper — add minutes to a "HH:MM" time string.
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}


/**
 * Helper — normalise a string for fuzzy name matching.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Helper — find the first catalog entry whose name matches (exact then partial).
 */
function matchByName(name: string, catalog: any[]): any | undefined {
  const n = normalizeName(name);
  return (
    catalog.find((c) => normalizeName(c.name) === n) ||
    catalog.find((c) => normalizeName(c.name).includes(n) || n.includes(normalizeName(c.name)))
  );
}

/**
 * Rebuild the billing items from the current state of a medical record and save.
 * Called every time a medical record is updated so the billing always reflects the latest MR.
 * Skips records with no linked billing or billing already marked as paid.
 */
export async function syncBillingFromRecord(recordId: string): Promise<void> {
  try {
    const record = await MedicalRecord.findById(recordId).lean();
    if (!record || !(record as any).billingId) return;

    const billing = await Billing.findById((record as any).billingId);
    if (!billing || billing.status === 'paid') return;

    // Fetch full catalogs (active only)
    const [allProducts, allVaccineTypes] = await Promise.all([
      ProductService.find({ isActive: true }).lean(),
      VaccineType.find({ isActive: true }).lean(),
    ]);

    const medCatalog  = allProducts.filter((p: any) => p.category === 'Medication');
    const diagCatalog = allProducts.filter((p: any) => p.category === 'Diagnostic Tests');
    const careCatalog = allProducts.filter((p: any) => p.category === 'Preventive Care');

    // Fetch pet species for species-aware titer lookup
    const pet = await Pet.findById((record as any).petId).select('species').lean();
    const petSpecies: string = (pet as any)?.species || '';
    const petWeightKg = parseFloat(String((record as any).vitals?.weight?.value ?? '')) || 0;

    // Exclusions for preventive care associated products the vet opted out of
    const preventiveExclusionSet = new Set<string>(
      ((record as any).preventiveAssociatedExclusions ?? []).map((id: string) => id.toString()),
    );

    const newItems: any[] = [];

    // Medications — quantity comes from medication.quantity (default 1)
    // Exception: single-dose injections are billed as qty 1; mlPerKg injections use dosage volume
    for (const med of (record as any).medications ?? []) {
      if (!med.name) continue;
      const match =
        medCatalog.find(
          (c: any) =>
            normalizeName(c.name) === normalizeName(med.name) &&
            (!c.administrationRoute || c.administrationRoute === med.route),
        ) || matchByName(med.name, medCatalog);
      const isSingleDoseInjection =
        match &&
        match.administrationRoute === 'injection' &&
        (match as any).injectionPricingType === 'singleDose';
      const isMlPerKgInjection =
        match &&
        match.administrationRoute === 'injection' &&
        (match as any).injectionPricingType === 'mlPerKg';

      let quantity = med.quantity ?? 1;
      if (isSingleDoseInjection) {
        quantity = 1;
      } else if (isMlPerKgInjection && med.dosage) {
        // Parse dosage string like "5.0 mL" → 5.0 and use mL as quantity (price is per mL)
        const mlMatch = String(med.dosage).match(/([\d.]+)\s*ml/i);
        quantity = mlMatch ? parseFloat(mlMatch[1]) : 1;
      }

      newItems.push({
        productServiceId: match ? match._id : null,
        vaccineTypeId: null,
        name: match ? match.name : med.name,
        type: 'Product',
        unitPrice: match ? match.price : 0,
        quantity,
      });
    }

    // Diagnostic Tests — quantity 1
    for (const test of (record as any).diagnosticTests ?? []) {
      if (!test.name) continue;
      const match = matchByName(test.name, diagCatalog);
      newItems.push({
        productServiceId: match ? match._id : null,
        vaccineTypeId: null,
        name: match ? match.name : test.name,
        type: 'Service',
        unitPrice: match ? match.price : 0,
        quantity: 1,
      });
    }

    // Preventive Care — service itself (qty 1) + associated medications and injections
    for (const care of (record as any).preventiveCare ?? []) {
      if (!care.product) continue;
      const match = matchByName(care.product, careCatalog);
      newItems.push({
        productServiceId: match ? match._id : null,
        vaccineTypeId: null,
        name: match ? match.name : care.product,
        type: 'Service',
        unitPrice: match ? match.price : 0,
        quantity: 1,
      });

      if (!match) continue;
      const careServiceId = match._id.toString();

      // Associated preventive medications (route=preventive, linked via associatedServiceId)
      const assocMeds = allProducts.filter(
        (p: any) =>
          p.administrationRoute === 'preventive' &&
          p.associatedServiceId?.toString() === careServiceId,
      );
      for (const assocMed of assocMeds) {
        if (preventiveExclusionSet.has(assocMed._id.toString())) continue;
        newItems.push({
          productServiceId: assocMed._id,
          vaccineTypeId: null,
          name: assocMed.name,
          type: 'Product',
          unitPrice: assocMed.price,
          quantity: assocMed.pricingType === 'pack' ? 1 : 1,
        });
      }

      // Associated injections (route=injection, linked via associatedServiceId)
      const assocInjs = allProducts.filter(
        (p: any) =>
          p.administrationRoute === 'injection' &&
          p.associatedServiceId?.toString() === careServiceId,
      );
      for (const assocInj of assocInjs) {
        if (preventiveExclusionSet.has(assocInj._id.toString())) continue;
        let injQty = 1;
        if ((assocInj as any).injectionPricingType === 'mlPerKg' && petWeightKg > 0) {
          // Compute mL dose: use doseConcentration (mg/mL) + dosePerKg (mg/kg), or fallback to dosePerKg as mL/kg
          const doseConcentration: number = (assocInj as any).doseConcentration ?? 0;
          const dosePerKg: number = (assocInj as any).dosePerKg ?? 0;
          if (doseConcentration > 0 && dosePerKg > 0) {
            injQty = parseFloat(((dosePerKg * petWeightKg) / doseConcentration).toFixed(2));
          } else if (dosePerKg > 0) {
            injQty = parseFloat((dosePerKg * petWeightKg).toFixed(2));
          }
          if (injQty <= 0) injQty = 1;
        }
        newItems.push({
          productServiceId: assocInj._id,
          vaccineTypeId: null,
          name: assocInj.name,
          type: 'Product',
          unitPrice: assocInj.price,
          quantity: injQty,
        });
      }
    }

    // Vaccinations — pull price from VaccineType.pricePerDose
    const vaccinations = await Vaccination.find({ medicalRecordId: recordId }).lean();
    for (const vax of vaccinations) {
      const vaccTypeId = vax.vaccineTypeId
        ? typeof vax.vaccineTypeId === 'object'
          ? (vax.vaccineTypeId as any).toString()
          : vax.vaccineTypeId
        : null;
      const vaccType = vaccTypeId
        ? allVaccineTypes.find((v: any) => v._id.toString() === vaccTypeId)
        : null;
      newItems.push({
        productServiceId: null,
        vaccineTypeId: vaccTypeId || null,
        name: vaccType ? vaccType.name : (vax as any).vaccineName || 'Vaccine',
        type: 'Service',
        unitPrice: vaccType ? vaccType.pricePerDose : 0,
        quantity: 1,
      });
    }

    // Confinement — quantity = number of days.
    // For an active confinement (action === 'confined') use a live day count from the
    // ConfinementRecord so the bill stays current on every save without requiring a manual
    // update of the medical record's confinementDays field.
    if ((record as any).confinementAction !== 'none') {
      let confDays: number = (record as any).confinementDays ?? 0;
      if ((record as any).confinementAction === 'confined' && (record as any).confinementRecordId) {
        const confRec = await ConfinementRecord
          .findById((record as any).confinementRecordId)
          .select('admissionDate')
          .lean();
        if ((confRec as any)?.admissionDate) {
          confDays = Math.max(1, Math.ceil(
            (Date.now() - new Date((confRec as any).admissionDate).getTime()) / 86_400_000,
          ));
        }
      }
      if (confDays > 0) {
        const confService = allProducts.find(
          (p: any) => p.type === 'Service' && normalizeName(p.name).includes('confinement'),
        );
        newItems.push({
          productServiceId: confService ? confService._id : null,
          vaccineTypeId: null,
          name: confService ? confService.name : 'Confinement',
          type: 'Service',
          unitPrice: confService ? confService.price : 0,
          quantity: confDays,
        });
      }
    }

    // Pregnancy Delivery — deliveryType stores the selected service name from the 'Pregnancy Delivery' catalog
    if ((record as any).pregnancyDelivery?.deliveryType) {
      const deliveryCatalog = allProducts.filter((p: any) => p.category === 'Pregnancy Delivery');
      const match = matchByName((record as any).pregnancyDelivery.deliveryType, deliveryCatalog);
      newItems.push({
        productServiceId: match ? match._id : null,
        vaccineTypeId: null,
        name: match ? match.name : (record as any).pregnancyDelivery.deliveryType,
        type: 'Service',
        unitPrice: match ? match.price : 0,
        quantity: 1,
      });
    }

    // Appointment types — add services that are not already covered by MR field sync
    if ((record as any).appointmentId) {
      const appt = await Appointment.findById((record as any).appointmentId)
        .select('types')
        .lean();

      if (appt?.types?.length) {
        // Human-readable labels keyed by appointment type value
        const APPT_TYPE_LABEL: Record<string, string> = {
          'consultation':             'Consultation',
          'general-checkup':          'General Checkup',
          'primary-treatment':        'Primary Treatment',
          'outpatient-treatment':     'Outpatient Treatment',
          'inpatient-care':           'Inpatient Care',
          'point-of-care-diagnostic': 'Point of Care Diagnostic',
          'laser-therapy':            'Laser Therapy',
          'dental-scaling':           'Dental Scaling',
          'cbc':                      'CBC Test',
          'blood-chemistry-16':       'Blood Chemistry (16)',
          'pcr-test':                 'PCR Test',
          'x-ray':                    'X-Ray',
          'ultrasound':               'Ultrasound',
          'abdominal-surgery':        'Abdominal Surgery',
          'orthopedic-surgery':       'Orthopedic Surgery',
          'Sterilization':            'Sterilization',
          'General Consultation':     'General Consultation',
        };

        // These are fully covered by other sync paths — skip to avoid double-billing
        const SKIP_APPT_TYPES = new Set([
          'vaccination', 'rabies-vaccination', 'puppy-litter-vaccination', 'booster',
          'deworming', 'flea-tick-prevention', 'Preventive Care',
          'basic-grooming', 'full-grooming', 'Grooming',
        ]);

        // productServiceIds already in newItems — used for dedup
        const usedIds = new Set(
          newItems.map((i) => i.productServiceId?.toString()).filter(Boolean),
        );

        for (const apptType of appt.types) {
          if (SKIP_APPT_TYPES.has(apptType)) continue;

          const label =
            APPT_TYPE_LABEL[apptType] ||
            apptType.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

          // Name-match against entire catalog
          const match = matchByName(label, allProducts);

          // Dedup: skip if same product already added from another sync path
          if (match && usedIds.has(match._id.toString())) continue;

          newItems.push({
            productServiceId: match ? match._id : null,
            vaccineTypeId: null,
            name: match ? match.name : label,
            type: 'Service',
            unitPrice: match ? match.price : 0,
            quantity: 1,
          });

          if (match) usedIds.add(match._id.toString());
        }
      }
    }

    // Titer testing — when titer is performed, add the species-appropriate titer service.
    // Detected by the "Immunity Testing" marker appended to the plan field.
    const hasTiterItem = newItems.some((item) => item.name.toLowerCase().includes('titer'));
    if (!hasTiterItem && typeof (record as any).plan === 'string' && (record as any).plan.includes('Immunity Testing')) {
      // Try species-specific first (e.g. "Canine Titer Testing" / "Feline Titer Testing")
      const speciesHint = petSpecies.toLowerCase().startsWith('f') ? 'feline' : 'canine';
      const titerMatch =
        allProducts.find(
          (p: any) =>
            normalizeName(p.name).includes('titer') &&
            normalizeName(p.name).includes(speciesHint),
        ) || allProducts.find((p: any) => normalizeName(p.name).includes('titer'));
      if (titerMatch) {
        newItems.push({
          productServiceId: titerMatch._id,
          vaccineTypeId: null,
          name: titerMatch.name,
          type: 'Service',
          unitPrice: titerMatch.price,
          quantity: 1,
        });
      }
    }

    const subtotal = newItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    billing.items = newItems;
    billing.subtotal = subtotal;
    billing.totalAmountDue = Math.max(0, subtotal - billing.discount);
    if (newItems.length > 0) {
      billing.serviceLabel = newItems.map((i) => i.name).join(', ');
    }
    await billing.save();
  } catch (err) {
    console.error('[MedicalRecord] syncBillingFromRecord error:', err);
    // Non-fatal — don't block the medical record save
  }
}

/**
 * Create a new medical record.
 * Accessible by: veterinarian, clinic-admin, clinic-admin.
 *
 * Business Rules:
 *  BR-MR-01: Only one record can be isCurrent=true per pet; creating a new one marks all previous as historical.
 *  BR-MR-02: vetId defaults to the logged-in vet's ID; clinic-admins must supply vetId in body.
 *  BR-MR-03: If appointmentId is provided, petId/clinicId/clinicBranchId/vetId are pre-filled from the appointment.
 *  BR-MR-04: Vitals are all optional — a record can be created with just a visitSummary/observations.
 *  BR-MR-05: New records are NOT shared with owner by default; vet or clinic-admin must explicitly share.
 */
export const createMedicalRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let { petId, clinicId, clinicBranchId, vetId, appointmentId } = req.body;
    const {
      vitals,
      images,
      overallObservation,
      visitSummary,
      vetNotes,
      confinementAction,
      confinementDays,
      confinementRecordId,
    } = req.body;

    // BR-MR-03: Pre-fill from appointment if provided
    if (appointmentId) {
      const appt = await Appointment.findById(appointmentId);
      if (!appt) {
        return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
      }
      // Check for duplicate: if a record already exists for this appointment, return it
      const existing = await MedicalRecord.findOne({ appointmentId });
      if (existing) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A medical record already exists for this appointment',
          data: { recordId: existing._id }
        });
      }
      petId = petId || appt.petId.toString();
      clinicId = clinicId || appt.clinicId.toString();
      clinicBranchId = clinicBranchId || (appt.clinicBranchId ? appt.clinicBranchId.toString() : null);
      vetId = vetId || appt.vetId.toString();
    }

    // BR-MR-02: Determine vetId
    if (req.user.userType === 'veterinarian') {
      vetId = req.user.userId;
    } else if (!vetId) {
      // clinic-admin without explicit vetId — use their own userId (they may not be a vet, but allows record creation)
      vetId = req.user.userId;
    }

    // Verify the pet exists
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (!pet.isAlive || pet.status === 'deceased') {
      return res.status(403).json({
        status: 'ERROR',
        message: `Pet deceased on ${pet.deceasedAt ? new Date(pet.deceasedAt).toLocaleDateString('en-US') : 'an earlier date'}. Records are read-only.`
      });
    }

    const owner = await User.findById(pet.ownerId).select('firstName lastName');
    const attendingUser = await User.findById(vetId).select('firstName lastName');
    const ownerName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'Unknown Owner';
    const vetName = `${attendingUser?.firstName || ''} ${attendingUser?.lastName || ''}`.trim() || 'Unknown Vet';

    // BR-MR-01: Mark any existing current records for this pet as historical
    await MedicalRecord.updateMany(
      { petId, isCurrent: true },
      { isCurrent: false }
    );

    // Parse base64 images into Buffers
    const parsedImages = (images || []).map((img: { data: string; contentType: string; description?: string }) => ({
      data: Buffer.from(img.data, 'base64'),
      contentType: img.contentType,
      description: img.description || ''
    }));

    const record = await MedicalRecord.create({
      petId,
      ownerId: pet.ownerId,
      petIsAlive: true,
      ownerAtTime: {
        name: ownerName,
        id: owner?._id ?? null,
      },
      vetAtTime: {
        name: vetName,
        id: attendingUser?._id ?? null,
      },
      vetId,
      clinicId,
      clinicBranchId: clinicBranchId || null,
      appointmentId: appointmentId || null,
      vitals: vitals || {},
      images: parsedImages,
      visitSummary: visitSummary || '',
      vetNotes: vetNotes || '',
      overallObservation: overallObservation || '',
      confinementAction: confinementAction || 'none',
      confinementDays: typeof confinementDays === 'number' ? confinementDays : 0,
      confinementRecordId: confinementRecordId || null,
      isCurrent: true
    });

    if (confinementRecordId) {
      await ConfinementRecord.findByIdAndUpdate(confinementRecordId, {
        $addToSet: { medicalRecordIds: record._id },
      });
    }

    const populated = await MedicalRecord.findById(record._id)
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .populate('petId', 'name species breed');

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Medical record created successfully',
      data: {
        record: {
          ...populated?.toObject(),
          images: (populated?.toObject().images || []).map((img: any) => ({
            _id: img._id,
            contentType: img.contentType,
            description: img.description
          }))
        }
      }
    });
  } catch (error: any) {
    console.error('Create medical record error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the medical record' });
  }
};

/**
 * Get all medical records for a pet (supports filtering by current/historical)
 */
export const getRecordsByPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      if (assignment) {
        isAuthorizedVet = true;
      } else {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    const isAdmin = isClinicAdminUser(req);

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view these records' });
    }

    const query: any = { petId: req.params.petId };
    // Vets and admins can see all records they created
    // For owners: allow access to all records (data is used for health metrics calculation)
    // Frontend will filter which records to display based on sharedWithOwner flag
    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      query.sharedWithOwner = true;
    }

    const currentRecord = await MedicalRecord.findOne({ ...query, isCurrent: true })
      .select('-images.data -vetNotes')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .populate('appointmentId', 'date startTime types status');

    const historicalRecords = await MedicalRecord.find({ ...query, isCurrent: false })
      .select('-images.data')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .populate('appointmentId', 'date startTime types status')
      .sort({ createdAt: -1 });

    const pregnancy = await getPregnancySnapshot(req.params.petId);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        currentRecord,
        historicalRecords,
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get records error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching records' });
  }
};

/**
 * Get current medical record for a pet
 */
export const getCurrentRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      if (assignment) {
        isAuthorizedVet = true;
      } else {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    const isAdmin = isClinicAdminUser(req);

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this record' });
    }

    const query: any = { petId: req.params.petId, isCurrent: true };
    // Vets and admins can see all records they created
    // For owners: allow access to current record (data is used for health metrics calculation)
    // Frontend will filter which records to display based on sharedWithOwner flag
    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      query.sharedWithOwner = true;
    }

    const record = await MedicalRecord.findOne(query)
      .select('-images.data')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .populate('appointmentId', 'date startTime types status');

    if (!record) {
      return res.status(404).json({ status: 'SUCCESS', message: 'No current medical record', data: { record: null } });
    }

    const pregnancy = await getPregnancySnapshot(req.params.petId);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        record,
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get current record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the record' });
  }
};

/**
 * Get historical medical records for a pet (all non-current records)
 */
export const getHistoricalRecords = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      if (assignment) {
        isAuthorizedVet = true;
      } else {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    const isAdmin = isClinicAdminUser(req);

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view these records' });
    }

    const query: any = { petId: req.params.petId, isCurrent: false };
    if (isOwner && !isAuthorizedVet && !isAdmin) {
      query.sharedWithOwner = true;
    }

    const records = await MedicalRecord.find(query)
      .select('-images.data')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .populate('appointmentId', 'date startTime types status')
      .sort({ createdAt: -1 });

    const pregnancy = await getPregnancySnapshot(req.params.petId);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        records,
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get historical records error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching records' });
  }
};

/**
 * Get a single medical record by ID (full report view)
 */
export const getRecordById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id)
      .populate({
        path: 'petId',
        select: 'name species breed sex dateOfBirth weight photo color sterilization nfcTagId microchipNumber allergies ownerId pregnancyStatus',
        populate: { path: 'ownerId', select: 'firstName lastName' }
      })
      .populate('vetId', 'firstName lastName email')
      .populate('clinicId', 'name address phone email')
      .populate('clinicBranchId', 'name address phone')
      .populate('appointmentId', 'date startTime endTime types status')
      .populate('followUps.vetId', 'firstName lastName');

    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    const pet = record.petId as any;
    const isOwner = pet.ownerId?.toString() === req.user.userId;
    const isRecordVet = record.vetId && (record.vetId as any)._id?.toString() === req.user.userId;
    const isAdmin = isClinicAdminUser(req);

    if (!isOwner && !isRecordVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this record' });
    }

    // Owners can only view records that have been explicitly shared by the vet
    if (isOwner && !isRecordVet && !isAdmin && !record.sharedWithOwner) {
      return res.status(403).json({ status: 'ERROR', message: 'This record has not been shared with you' });
    }

    const recordObj = record.toObject() as any;
    recordObj.images = recordObj.images.map((img: any) => ({
      _id: img._id,
      data: img.data ? img.data.toString('base64') : null,
      contentType: img.contentType,
      description: img.description
    }));

    recordObj.followUps = (recordObj.followUps || []).map((fu: any) => ({
      ...fu,
      media: (fu.media || []).map((m: any) => ({
        _id: m._id,
        data: m.data ? m.data.toString('base64') : null,
        contentType: m.contentType,
        description: m.description
      }))
    }));

    if (isOwner && !isRecordVet && !isAdmin) {
      delete recordObj.vetNotes;
    }

    const pregnancy = await getPregnancySnapshot((record.petId as any)._id.toString());

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        record: recordObj,
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the record' });
  }
};

/**
 * Get a medical record by appointmentId.
 * Accessible by: veterinarian, clinic-admin.
 *
 * Business Rule BR-MR-06: Each appointment may have at most one medical record.
 */
export const getRecordByAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let record = await MedicalRecord.findOne({ appointmentId: req.params.appointmentId })
      .populate('petId', 'name species breed sex dateOfBirth weight photo')
      .populate('vetId', 'firstName lastName email')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address');

    if (!record) {
      const appointment = await Appointment.findById(req.params.appointmentId)
        .select('ownerId petId vetId clinicId clinicBranchId status medicalRecordId');

      if (appointment && appointment.vetId && appointment.status === 'in_progress') {
        const [owner, vet] = await Promise.all([
          User.findById(appointment.ownerId).select('firstName lastName'),
          User.findById(appointment.vetId).select('firstName lastName'),
        ]);

        const ownerName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'Unknown Owner';
        const vetName = `${vet?.firstName || ''} ${vet?.lastName || ''}`.trim() || 'Unknown Vet';

        await MedicalRecord.updateMany(
          { petId: appointment.petId, isCurrent: true },
          { $set: { isCurrent: false } }
        );

        const created = await MedicalRecord.create({
          petId: appointment.petId,
          ownerId: appointment.ownerId,
          petIsAlive: true,
          ownerAtTime: {
            name: ownerName,
            id: owner?._id ?? null,
          },
          vetAtTime: {
            name: vetName,
            id: vet?._id ?? null,
          },
          vetId: appointment.vetId,
          clinicId: appointment.clinicId,
          clinicBranchId: appointment.clinicBranchId,
          appointmentId: appointment._id,
          stage: 'pre_procedure',
          isCurrent: true,
        });

        if (!appointment.medicalRecordId) {
          appointment.medicalRecordId = created._id as any;
          await appointment.save();
        }

        record = await MedicalRecord.findById(created._id)
          .populate('petId', 'name species breed sex dateOfBirth weight photo')
          .populate('vetId', 'firstName lastName email')
          .populate('clinicId', 'name')
          .populate('clinicBranchId', 'name address');
      }
    }

    if (!record) {
      return res.status(404).json({ status: 'SUCCESS', message: 'No medical record for this appointment', data: { record: null } });
    }

    const pregnancy = await getPregnancySnapshot((record.petId as any)._id.toString());

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        record,
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get record by appointment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the record' });
  }
};

/**
 * Get all medical records created by the current vet (or all records in clinic for clinic-admin).
 * Accessible by: veterinarian, clinic-admin, clinic-admin.
 *
 * Query params:
 *  - petId: filter by pet
 *  - limit: page size (default 50)
 *  - offset: skip (default 0)
 */
export const getVetMedicalRecords = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId, limit = '50', offset = '0' } = req.query;
    const query: any = {};

    if (req.user.userType === 'veterinarian') {
      query.vetId = req.user.userId;
    } else if (req.user.userType === 'clinic-admin') {
      let clinicId: string | undefined = req.user.clinicId;
      let branchId: string | undefined = req.user.clinicBranchId;

      // Stale-JWT fallback: look up missing fields from the User document
      if (!clinicId || !branchId) {
        const dbUser = await User.findById(req.user.userId).select('clinicId clinicBranchId');
        if (!clinicId && dbUser?.clinicId) clinicId = dbUser.clinicId.toString();
        if (!branchId && dbUser?.clinicBranchId) branchId = dbUser.clinicBranchId.toString();
      }

      if (clinicId) query.clinicId = clinicId;
      // Only scope to branch if this is a non-main admin
      if (branchId && !req.user.isMainBranch) query.clinicBranchId = branchId;
    }

    if (petId) query.petId = petId;

    const records = await MedicalRecord.find(query)
      .select('-images.data -vetNotes')
      .populate({ path: 'petId', select: 'name species breed photo ownerId', populate: { path: 'ownerId', select: 'firstName lastName' } })
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .populate('appointmentId', 'date startTime types')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await MedicalRecord.countDocuments(query);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { records, total }
    });
  } catch (error) {
    console.error('Get vet medical records error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching records' });
  }
};

/**
 * Update a medical record.
 * Accessible by: the creating vet OR clinic-admin/clinic-admin.
 *
 * Business Rule BR-MR-07: Clinic admins can update any record in their clinic.
 */
export const updateRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    const pet = await Pet.findById(record.petId).select('isAlive status deceasedAt');
    if (pet && (!pet.isAlive || pet.status === 'deceased')) {
      return res.status(403).json({
        status: 'ERROR',
        message: `Pet deceased on ${pet.deceasedAt ? new Date(pet.deceasedAt).toLocaleDateString('en-US') : 'an earlier date'}. Records are read-only.`
      });
    }

    const isAdmin = isClinicAdminUser(req);
    if (record.vetId.toString() !== req.user.userId && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the attending vet or clinic admin can update this record' });
    }

    const {
      vitals, images, overallObservation, sharedWithOwner, visitSummary, vetNotes,
      stage, chiefComplaint, subjective, assessment, plan,
      medications, diagnosticTests, preventiveCare, preventiveAssociatedExclusions,
      confinementAction, confinementDays, confinementRecordId,
      referral, discharge, scheduledSurgery,
      surgeryRecord, pregnancyRecord, pregnancyDelivery, pregnancyLoss, pregnancyEvidenceSource
    } = req.body;

    if (vitals) record.vitals = vitals;
    if (overallObservation !== undefined) record.overallObservation = overallObservation;
    if (visitSummary !== undefined) record.visitSummary = visitSummary;
    if (vetNotes !== undefined) record.vetNotes = vetNotes;
    if (surgeryRecord !== undefined) (record as any).surgeryRecord = surgeryRecord;
    if (pregnancyRecord !== undefined) (record as any).pregnancyRecord = pregnancyRecord;
    if (pregnancyDelivery !== undefined) (record as any).pregnancyDelivery = pregnancyDelivery;
    if (pregnancyLoss !== undefined) (record as any).pregnancyLoss = pregnancyLoss;
    if (sharedWithOwner !== undefined) record.sharedWithOwner = sharedWithOwner;
    if (stage !== undefined) record.stage = stage;
    if (chiefComplaint !== undefined) record.chiefComplaint = chiefComplaint;
    if (subjective !== undefined) record.subjective = subjective;
    if (assessment !== undefined) record.assessment = assessment;
    if (plan !== undefined) record.plan = plan;
    if (medications !== undefined) record.medications = medications;
    if (diagnosticTests !== undefined) record.diagnosticTests = diagnosticTests;
    if (preventiveCare !== undefined) record.preventiveCare = preventiveCare;
    if (preventiveAssociatedExclusions !== undefined) (record as any).preventiveAssociatedExclusions = preventiveAssociatedExclusions;
    if (confinementAction !== undefined) record.confinementAction = confinementAction;
    if (confinementDays !== undefined) record.confinementDays = confinementDays;
    if (confinementRecordId !== undefined) (record as any).confinementRecordId = confinementRecordId || null;
    if (referral !== undefined) record.referral = referral;
    if (discharge !== undefined) record.discharge = discharge;
    if (scheduledSurgery !== undefined) record.scheduledSurgery = scheduledSurgery;

    if (confinementAction === 'confined') {
      let linkedConfinement = (record as any).confinementRecordId
        ? await ConfinementRecord.findById((record as any).confinementRecordId)
        : null;

      if (!linkedConfinement) {
        linkedConfinement = await ConfinementRecord.findOne({
          petId: record.petId,
          status: 'admitted',
        }).sort({ admissionDate: -1 });
      }

      if (!linkedConfinement) {
        linkedConfinement = new ConfinementRecord({
          petId: record.petId,
          vetId: record.vetId,
          clinicId: record.clinicId,
          clinicBranchId: record.clinicBranchId ?? null,
          appointmentId: record.appointmentId ?? null,
          reason: chiefComplaint || record.chiefComplaint || 'Confinement monitoring',
          notes: visitSummary || record.visitSummary || '',
          admissionDate: new Date(),
          status: 'admitted',
          medicalRecordIds: [record._id],
        } as any);
        await linkedConfinement.save();
      } else {
        await ConfinementRecord.findByIdAndUpdate(linkedConfinement._id, {
          $addToSet: { medicalRecordIds: record._id },
          $set: {
            clinicId: record.clinicId,
            clinicBranchId: record.clinicBranchId ?? null,
            appointmentId: record.appointmentId ?? null,
            vetId: record.vetId,
          },
        });
      }

      (record as any).confinementRecordId = linkedConfinement._id;
      await Pet.findByIdAndUpdate(record.petId, {
        $set: {
          isConfined: true,
          confinedSince: (linkedConfinement as any).admissionDate || new Date(),
          currentConfinementRecordId: linkedConfinement._id,
        },
      });
    }

    if (confinementAction === 'released') {
      let linkedConfinement = (record as any).confinementRecordId
        ? await ConfinementRecord.findById((record as any).confinementRecordId)
        : null;

      if (!linkedConfinement) {
        linkedConfinement = await ConfinementRecord.findOne({
          petId: record.petId,
          status: 'admitted',
        }).sort({ admissionDate: -1 });
      }

      if (linkedConfinement) {
        const dischargeAt = new Date();
        await ConfinementRecord.findByIdAndUpdate(linkedConfinement._id, {
          $set: {
            status: 'discharged',
            dischargeDate: dischargeAt,
            vetId: record.vetId,
          },
          $addToSet: { medicalRecordIds: record._id },
        });

        (record as any).confinementRecordId = linkedConfinement._id;
      }

      await Pet.findByIdAndUpdate(record.petId, {
        $set: {
          isConfined: false,
          confinedSince: null,
          currentConfinementRecordId: null,
        },
      });
    }

    if (images) {
      record.images = images.map((img: { data: string; contentType: string; description?: string }) => ({
        data: Buffer.from(img.data, 'base64'),
        contentType: img.contentType,
        description: img.description || ''
      }));
    }

    // If marking the record as completed and it's a sterilization appointment, update the pet's sterilization status
    if (stage === 'completed' && record.appointmentId) {
      const appointment = await Appointment.findById(record.appointmentId);
      if (appointment && appointment.types) {
        const hasSterilization = appointment.types.some((t: string) => 
          t === 'sterilization' || t === 'Sterilization'
        );

        if (hasSterilization) {
          const pet = await Pet.findById(record.petId);
          if (pet) {
            // Update sterilization status based on pet's sex
            if (pet.sex === 'female') {
              pet.sterilization = 'spayed';
            } else if (pet.sex === 'male') {
              pet.sterilization = 'neutered';
            }
            await pet.save();
          }
        }
      }
    }

    // When the record is completed, schedule boosters for any linked vaccinations that have a
    // nextDueDate but no booster appointment yet (booster scheduling was deferred from create/update).
    if (stage === 'completed') {
      try {
        const pendingVax = await Vaccination.find({
          medicalRecordId: record._id,
          nextDueDate: { $ne: null },
          boosterAppointmentId: null,
        }).lean();

        for (const vax of pendingVax) {
          const boosterDate = new Date(vax.nextDueDate as Date);
          boosterDate.setUTCHours(0, 0, 0, 0);

          const resolvedClinicId = vax.clinicId;
          let resolvedBranchId: string | null = vax.clinicBranchId ? vax.clinicBranchId.toString() : null;

          if (!resolvedBranchId) {
            const vetUser = await User.findById(vax.vetId).select('clinicBranchId').lean();
            if ((vetUser as any)?.clinicBranchId) {
              resolvedBranchId = (vetUser as any).clinicBranchId.toString();
            } else if (resolvedClinicId) {
              const branch = await ClinicBranch.findOne({ clinicId: resolvedClinicId }).select('_id').lean();
              if (branch) resolvedBranchId = branch._id.toString();
            }
          }

          if (!resolvedClinicId || !resolvedBranchId) continue;

          const pet = await Pet.findById(vax.petId).select('ownerId name').lean();
          const candidateSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
          let boosterApptId: string | null = null;

          for (const startTime of candidateSlots) {
            const endTime = addMinutesToTime(startTime, 30);
            try {
              const boosterAppt = await Appointment.create({
                petId: vax.petId,
                ownerId: (pet as any)?.ownerId,
                vetId: vax.vetId,
                clinicId: resolvedClinicId,
                clinicBranchId: resolvedBranchId,
                mode: 'face-to-face',
                types: ['vaccination'],
                date: boosterDate,
                startTime,
                endTime,
                status: 'confirmed',
                notes: `Auto-scheduled booster for ${vax.vaccineName}`,
              });
              boosterApptId = boosterAppt._id.toString();
              break;
            } catch (slotErr: any) {
              if (slotErr?.code === 11000) continue;
              break;
            }
          }

          if (boosterApptId) {
            await Vaccination.findByIdAndUpdate(vax._id, { boosterAppointmentId: boosterApptId });
            const boosterDateStr = boosterDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            if ((pet as any)?.ownerId) {
              createNotification(
                (pet as any).ownerId.toString(),
                'appointment_scheduled',
                'Booster Appointment Scheduled',
                `A booster appointment for ${vax.vaccineName} has been automatically confirmed for ${boosterDateStr}.`,
                { appointmentId: boosterApptId, vaccineName: vax.vaccineName }
              ).catch(() => {});
            }
            if (vax.vetId) {
              createNotification(
                vax.vetId.toString(),
                'appointment_scheduled',
                'Booster Appointment Scheduled',
                `A booster appointment for ${vax.vaccineName} has been auto-scheduled for ${(pet as any)?.name || 'the patient'} on ${boosterDateStr}.`,
                { appointmentId: boosterApptId, vaccineName: vax.vaccineName, petId: vax.petId }
              ).catch(() => {});
            }
          }
        }
      } catch (boosterErr) {
        console.error('[MedicalRecord] Error scheduling vaccination boosters on completion:', boosterErr);
        // Don't block the visit completion on booster scheduling error
      }
    }


    await record.save();

    if ((record as any).confinementRecordId) {
      await ConfinementRecord.findByIdAndUpdate((record as any).confinementRecordId, {
        $addToSet: { medicalRecordIds: record._id },
      });
    }

    // Sync billing items from the updated medical record (fire-and-forget, non-fatal)
    syncBillingFromRecord(record._id.toString()).catch((e) =>
      console.error('[MedicalRecord] Background billing sync failed:', e),
    );

    // When the medical record is completed, notify the owner that the invoice is ready for payment
    if (stage === 'completed' && record.billingId) {
      try {
        const billing = await Billing.findById(record.billingId)
          .populate('ownerId', 'firstName lastName email')
          .populate('petId', 'name')
          .populate('vetId', 'firstName lastName');
        if (billing) {
          const owner = billing.ownerId as any;
          const pet   = billing.petId   as any;
          const vet   = billing.vetId   as any;
          if (owner?.email && pet?.name) {
            sendBillingPendingPayment({
              ownerEmail:    owner.email,
              ownerFirstName: owner.firstName,
              petName:       pet.name,
              vetName:       vet ? `${vet.firstName} ${vet.lastName}` : 'the veterinarian',
              items:         billing.items,
              subtotal:      billing.subtotal,
              discount:      billing.discount,
              totalAmountDue: billing.totalAmountDue,
              serviceDate:   billing.serviceDate,
            });
          }
          if (owner?._id && pet?.name) {
            await createNotification(
              owner._id.toString(),
              'bill_due',
              'New Invoice Ready',
              `A new invoice of ₱${billing.totalAmountDue.toFixed(2)} for ${pet.name} is ready for payment.`,
              { billingId: billing._id },
            );
          }
        }
      } catch (billNotifyErr) {
        console.error('[MedicalRecord] Billing notification on completion failed:', billNotifyErr);
        // Non-fatal
      }
    }

    // Auto-schedule post-delivery follow-up when mother condition is critical
    if (stage === 'completed' && pregnancyDelivery && pregnancyDelivery.motherCondition === 'critical') {
      try {
        const followUpDate = addDays(new Date(), 3);
        followUpDate.setUTCHours(0, 0, 0, 0);

        let resolvedBranchId: string | null = record.clinicBranchId
          ? record.clinicBranchId.toString()
          : null;

        if (!resolvedBranchId && record.clinicId) {
          const branch = await ClinicBranch.findOne({ clinicId: record.clinicId }).select('_id').lean();
          if (branch) resolvedBranchId = branch._id.toString();
        }

        if (record.clinicId && resolvedBranchId) {
          const pet = await Pet.findById(record.petId).select('ownerId name').lean();
          const candidateSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];

          for (const startTime of candidateSlots) {
            const endTime = addMinutesToTime(startTime, 30);
            try {
              const followUpAppt = await Appointment.create({
                petId: record.petId,
                ownerId: (pet as any)?.ownerId,
                vetId: record.vetId,
                clinicId: record.clinicId,
                clinicBranchId: resolvedBranchId,
                mode: 'face-to-face',
                types: ['checkup'],
                date: followUpDate,
                startTime,
                endTime,
                status: 'confirmed',
                notes: 'Post-delivery follow-up — maternal critical condition',
              });

              const dateStr = followUpDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              const petName = (pet as any)?.name || 'The patient';

              if ((pet as any)?.ownerId) {
                createNotification(
                  (pet as any).ownerId.toString(),
                  'appointment_scheduled',
                  'Post-Delivery Follow-Up Scheduled',
                  `${petName} had a critical delivery. A follow-up appointment has been automatically scheduled for ${dateStr}.`,
                  { appointmentId: followUpAppt._id, petId: record.petId }
                ).catch(() => {});
              }
              if (record.vetId) {
                createNotification(
                  record.vetId.toString(),
                  'appointment_scheduled',
                  'Post-Delivery Follow-Up Scheduled',
                  `${petName} had a critical delivery. A follow-up appointment has been automatically scheduled for ${dateStr}.`,
                  { appointmentId: followUpAppt._id, petId: record.petId }
                ).catch(() => {});
              }
              break;
            } catch (slotErr: any) {
              if (slotErr?.code === 11000) continue;
              break;
            }
          }
        }
      } catch (followUpErr) {
        console.error('[MedicalRecord] Error scheduling critical post-delivery follow-up:', followUpErr);
        // Don't block record save on scheduling error
      }
    }

    if (pregnancyRecord !== undefined || pregnancyDelivery !== undefined || pregnancyLoss !== undefined) {
      try {
        await syncPregnancyFromMedicalRecord({
          petId: record.petId.toString(),
          actorId: req.user.userId,
          medicalRecordId: record._id.toString(),
          pregnancyRecord: pregnancyRecord === undefined ? undefined : pregnancyRecord,
          pregnancyDelivery: pregnancyDelivery === undefined ? undefined : pregnancyDelivery,
          pregnancyLoss: pregnancyLoss === undefined ? undefined : pregnancyLoss,
          diagnosticTests: (diagnosticTests || record.diagnosticTests || []).map((t: any) => ({
            testType: t.testType,
            name: t.name,
          })),
          evidenceSource: (pregnancyEvidenceSource as PregnancyEvidenceSource | undefined),
        });
      } catch (pregErr) {
        console.error('[MedicalRecord] Pregnancy domain sync failed:', pregErr);
        return res.status(400).json({
          status: 'ERROR',
          message: pregErr instanceof Error ? pregErr.message : 'Pregnancy validation failed',
        });
      }
    }

    const pregnancy = await getPregnancySnapshot(record.petId.toString());

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Medical record updated successfully',
      data: {
        record: {
          ...record.toObject(),
          images: (record.toObject().images || []).map((img: any) => ({
            _id: img._id,
            contentType: img.contentType,
            description: img.description
          }))
        },
        petPregnancy: {
          status: pregnancy.status,
          activeEpisode: pregnancy.activeEpisode,
        },
      }
    });
  } catch (error: any) {
    console.error('Update record error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the record' });
  }
};

/**
 * Toggle sharing a medical record with the pet owner.
 * Accessible by: creating vet OR clinic-admin/clinic-admin.
 *
 * Business Rule BR-MR-05: Records are private by default; must be explicitly shared.
 */
export const toggleShareRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    const isAdmin = isClinicAdminUser(req);
    if (record.vetId.toString() !== req.user.userId && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the attending vet or clinic admin can share this record' });
    }

    const { shared } = req.body;
    record.sharedWithOwner = typeof shared === 'boolean' ? shared : !record.sharedWithOwner;
    await record.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: record.sharedWithOwner ? 'Record shared with pet owner' : 'Record unshared',
      data: { sharedWithOwner: record.sharedWithOwner }
    });
  } catch (error) {
    console.error('Toggle share error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Add a follow-up entry to an active (isCurrent=true) medical record.
 * Only the attending vet or a clinic/branch admin can add follow-ups.
 */
export const createFollowUp = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    if (!record.isCurrent) {
      return res.status(400).json({ status: 'ERROR', message: 'Follow-up records can only be added to the active medical record' });
    }

    const isAdmin = isClinicAdminUser(req);
    if (record.vetId.toString() !== req.user.userId && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the attending vet or clinic admin can add follow-ups' });
    }

    const { ownerObservations, vetNotes, sharedWithOwner, media } = req.body;
    if (!ownerObservations?.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Owner observations are required' });
    }

    const parsedMedia = (media || []).map((m: { data: string; contentType: string; description?: string }) => ({
      data: Buffer.from(m.data, 'base64'),
      contentType: m.contentType,
      description: m.description || ''
    }));

    (record.followUps as any[]).push({
      vetId: req.user.userId,
      ownerObservations: ownerObservations.trim(),
      vetNotes: (vetNotes || '').trim(),
      sharedWithOwner: sharedWithOwner === true,
      media: parsedMedia,
    });

    await record.save();

    // Populate vetId on the follow-ups before returning
    await record.populate('followUps.vetId', 'firstName lastName');

    // Serialize media buffers to base64 for the response
    const serializedFollowUps = (record.followUps as any[]).map((fu) => ({
      ...fu.toObject(),
      media: (fu.media || []).map((m: any) => ({
        _id: m._id,
        data: m.data ? m.data.toString('base64') : null,
        contentType: m.contentType,
        description: m.description
      }))
    }));

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Follow-up record added successfully',
      data: { followUps: serializedFollowUps }
    });
  } catch (error) {
    console.error('Create follow-up error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Get all vaccinations for a pet (accessible by owner, vet, clinic admin)
 */
export const getVaccinationsByPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    const isAdmin = isClinicAdminUser(req);
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      if (assignment) {
        isAuthorizedVet = true;
      } else {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view these vaccinations' });
    }

    const vaccinations = await Vaccination.find({ petId: req.params.petId })
      .populate('vaccineTypeId', 'name isSeries totalSeries doseVolumeMl')
      .populate('vetId', 'firstName lastName prcLicenseNumber licenseNumber')
      .populate('clinicId', 'name')
      .sort({ dateAdministered: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations }
    });
  } catch (error) {
    console.error('Get vaccinations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccinations' });
  }
};

/**
 * Get a single image from a medical record
 */
/**
 * Get aggregated medical history for a pet (all operations, medications, vaccines, pregnancy, etc.)
 * Used for displaying a comprehensive history view while filling/viewing medical records
 */
export const getMedicalHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const petId = req.params.petId;
    
    // Get pet info
    const pet = await Pet.findById(petId).lean();
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Authorization: owner, vet who treated this pet or is assigned to it, or clinic admin
    const isOwner = pet.ownerId.toString() === req.user.userId;
    const isAdmin = req.user.userType === 'clinic-admin';
    let isAuthorizedVet = false;
    if (req.user.userType === 'veterinarian') {
      const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId });
      isAuthorizedVet = !!hasRecords;
      if (!isAuthorizedVet) {
        const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId, isActive: true });
        isAuthorizedVet = !!assignment;
      }
    }

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this pet\'s history' });
    }

    // Get all medical records for this pet (sorted by date, most recent first)
    const allRecords = await MedicalRecord.find({ petId })
      .populate('surgeryRecord')
      .sort({ createdAt: -1 });

    // Calculate pet age
    const calculateAge = (dob: Date) => {
      const now = new Date();
      const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (months < 12) return `${months}mo`;
      const years = Math.floor(months / 12);
      const rem = months % 12;
      return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`;
    };

    // 1. Extract all operations (surgeries from all records)
    const operations = allRecords
      .filter(r => r.surgeryRecord)
      .map(r => ({
        date: r.createdAt,
        surgeryType: (r.surgeryRecord as any)?.surgeryType || '',
        vetRemarks: (r.surgeryRecord as any)?.vetRemarks || '',
        clinicName: '',
        clinicId: r.clinicId.toString(),
      }));

    // 2. Extract all unique medications (deduplicated by name, prioritize active status)
    const medicationMap = new Map<string, any>();
    allRecords.forEach(r => {
      r.medications?.forEach(med => {
        const key = med.name.toLowerCase();
        if (!medicationMap.has(key)) {
          medicationMap.set(key, {
            name: med.name,
            dosage: med.dosage,
            route: med.route,
            frequency: med.frequency,
            startDate: med.startDate,
            endDate: med.endDate,
            status: med.status,
            notes: med.notes,
          });
        } else {
          // Keep active medications if found
          const existing = medicationMap.get(key);
          if (med.status === 'active' && existing.status !== 'active') {
            medicationMap.set(key, {
              name: med.name,
              dosage: med.dosage,
              route: med.route,
              frequency: med.frequency,
              startDate: med.startDate,
              endDate: med.endDate,
              status: med.status,
              notes: med.notes,
            });
          }
        }
      });
    });
    const medications = Array.from(medicationMap.values())
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
      });

    // 3. Why patient is here today (chief complaint from today's record)
    const todayRecord = allRecords.find(r => {
      const recordDate = new Date(r.createdAt);
      const today = new Date();
      return recordDate.toDateString() === today.toDateString();
    });
    const chiefComplaint = todayRecord?.chiefComplaint || '';

    // 4. Most recent SOAP notes
    const latestRecordWithSOAP = allRecords.find(r => r.assessment || r.plan || r.subjective);
    const latestSOAP = latestRecordWithSOAP ? {
      date: latestRecordWithSOAP.createdAt,
      subjective: latestRecordWithSOAP.subjective || '',
      objective: latestRecordWithSOAP.overallObservation || '',
      assessment: latestRecordWithSOAP.assessment || '',
      plan: latestRecordWithSOAP.plan || '',
    } : null;

    // 5. All vaccinations
    const vaccinations = await Vaccination.find({ petId })
      .populate('vaccineTypeId', 'name')
      .sort({ dateAdministered: -1 });

    const formattedVaccinations = vaccinations.map(v => ({
      name: (v.vaccineTypeId as any)?.name || 'Unknown Vaccine',
      status: v.status,
      dateAdministered: v.dateAdministered,
      nextDueDate: v.nextDueDate,
      route: v.route,
      manufacturer: v.manufacturer,
      batchNumber: v.batchNumber,
    }));

    // 6. Pregnancy records if female
    const pregnancyRecords: any[] = [];
    if (pet.sex === 'female') {
      allRecords.forEach(r => {
        if (r.pregnancyRecord) {
          pregnancyRecords.push({
            date: r.createdAt,
            isPregnant: r.pregnancyRecord.isPregnant,
            gestationDate: r.pregnancyRecord.gestationDate,
            expectedDueDate: r.pregnancyRecord.expectedDueDate,
            litterNumber: r.pregnancyRecord.litterNumber,
          });
        }
        if (r.pregnancyDelivery) {
          pregnancyRecords.push({
            date: r.createdAt,
            deliveryDate: r.pregnancyDelivery.deliveryDate,
            deliveryType: r.pregnancyDelivery.deliveryType,
            motherCondition: r.pregnancyDelivery.motherCondition,
          });
        }
      });
    }

    const pregnancySnapshot = await getPregnancySnapshot(petId);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        pet: {
          _id: pet._id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          secondaryBreed: pet.secondaryBreed,
          sex: pet.sex,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          age: calculateAge(pet.dateOfBirth),
          sterilization: pet.sterilization,
          color: pet.color,
          microchipNumber: pet.microchipNumber,
          nfcTagId: pet.nfcTagId,
          photo: pet.photo,
          allergies: pet.allergies,
          pregnancyStatus: pregnancySnapshot.status,
        },
        operations,
        medications,
        chiefComplaint,
        latestSOAP,
        vaccinations: formattedVaccinations,
        pregnancyRecords,
        petPregnancy: {
          status: pregnancySnapshot.status,
          activeEpisode: pregnancySnapshot.activeEpisode,
        },
      }
    });
  } catch (error) {
    console.error('Get medical history error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching medical history' });
  }
};

export const getRecordImage = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    const image = (record.images as any).id(req.params.imageId);
    if (!image) {
      return res.status(404).json({ status: 'ERROR', message: 'Image not found' });
    }

    res.set('Content-Type', image.contentType);
    return res.send(image.data);
  } catch (error) {
    console.error('Get image error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the image' });
  }
};

/**
 * Get the full pregnancy episode history for a pet.
 * Returns all closed + active pregnancy episodes in chronological order.
 */
export const getPregnancyHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.petId).lean();
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    const isAdmin = isClinicAdminUser(req);
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      if (assignment) {
        isAuthorizedVet = true;
      } else {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    if (!isOwner && !isAuthorizedVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this pet\'s pregnancy history' });
    }

    const history = await getPregnancyEpisodeHistory(req.params.petId);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { history },
    });
  } catch (error) {
    console.error('Get pregnancy history error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching pregnancy history' });
  }
};
