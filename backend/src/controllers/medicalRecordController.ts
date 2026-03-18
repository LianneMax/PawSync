import { Request, Response } from 'express';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import AssignedVet from '../models/AssignedVet';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import { createNotification } from '../services/notificationService';

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
 * Helper — Create auto-scheduled appointments for preventive care items when visit is completed
 */
async function autoSchedulePreventiveCareAppointments(
  record: any,
  preventiveCare: any[],
  userId: string
): Promise<void> {
  if (!preventiveCare || preventiveCare.length === 0) return;

  for (const care of preventiveCare) {
    try {
      // Skip if no nextDueDate
      if (!care.nextDueDate) continue;

      const scheduledDate = new Date(care.nextDueDate);
      scheduledDate.setUTCHours(0, 0, 0, 0);

      const pet = await Pet.findById(record.petId);
      if (!pet) continue;

      let resolvedBranchId: string | null = record.clinicBranchId
        ? record.clinicBranchId.toString()
        : null;

      if (!resolvedBranchId) {
        const vet = await User.findById(record.vetId).select('clinicBranchId').lean();
        if (vet?.clinicBranchId) {
          resolvedBranchId = vet.clinicBranchId.toString();
        } else if (record.clinicId) {
          const branch = await ClinicBranch.findOne({ clinicId: record.clinicId }).select('_id').lean();
          if (branch) resolvedBranchId = branch._id.toString();
        }
      }

      if (!record.clinicId || !resolvedBranchId) continue;

      // Try several time slots for appointment
      const candidateSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
      
      for (const startTime of candidateSlots) {
        const endTime = addMinutesToTime(startTime, 30);
        try {
          await Appointment.create({
            petId: record.petId,
            ownerId: pet.ownerId,
            vetId: record.vetId,
            clinicId: record.clinicId,
            clinicBranchId: resolvedBranchId,
            mode: 'face-to-face',
            types: [
              care.careType === 'flea' || care.careType === 'tick' ? 'flea-tick-prevention' :
              care.careType === 'deworming' ? 'deworming' :
              care.careType === 'heartworm' ? 'heartworm' :
              'flea-tick-prevention'
            ],
            date: scheduledDate,
            startTime,
            endTime,
            status: 'confirmed',
            notes: `Auto-scheduled ${care.product} - Next due preventive care`,
          });
          break; // Appointment created successfully
        } catch (slotErr: any) {
          if (slotErr?.code === 11000) continue; // Slot conflict, try next
          break; // Other error, stop trying
        }
      }
    } catch (err) {
      console.error(`[PreventiveCare] Error auto-scheduling ${care.product}:`, err);
      // Continue with next item even if one fails
    }
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
    const { vitals, images, overallObservation, visitSummary, vetNotes } = req.body;

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
      vetId,
      clinicId,
      clinicBranchId: clinicBranchId || null,
      appointmentId: appointmentId || null,
      vitals: vitals || {},
      images: parsedImages,
      visitSummary: visitSummary || '',
      vetNotes: vetNotes || '',
      overallObservation: overallObservation || '',
      isCurrent: true
    });

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

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        currentRecord,
        historicalRecords
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

    return res.status(200).json({
      status: 'SUCCESS',
      data: { record }
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

    return res.status(200).json({
      status: 'SUCCESS',
      data: { records }
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
      .populate('petId', 'name species breed sex dateOfBirth weight photo color sterilization nfcTagId microchipNumber allergies ownerId')
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

    return res.status(200).json({
      status: 'SUCCESS',
      data: { record: recordObj }
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

    const record = await MedicalRecord.findOne({ appointmentId: req.params.appointmentId })
      .populate('petId', 'name species breed sex dateOfBirth weight photo')
      .populate('vetId', 'firstName lastName email')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address');

    if (!record) {
      return res.status(404).json({ status: 'SUCCESS', message: 'No medical record for this appointment', data: { record: null } });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { record }
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

    const isAdmin = isClinicAdminUser(req);
    if (record.vetId.toString() !== req.user.userId && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the attending vet or clinic admin can update this record' });
    }

    const {
      vitals, images, overallObservation, sharedWithOwner, visitSummary, vetNotes,
      stage, chiefComplaint, subjective, assessment, plan,
      medications, diagnosticTests, preventiveCare, confinementAction, confinementDays,
      referral, discharge, scheduledSurgery,
      surgeryRecord, pregnancyRecord, pregnancyDelivery
    } = req.body;

    if (vitals) record.vitals = vitals;
    if (overallObservation !== undefined) record.overallObservation = overallObservation;
    if (visitSummary !== undefined) record.visitSummary = visitSummary;
    if (vetNotes !== undefined) record.vetNotes = vetNotes;
    if (surgeryRecord !== undefined) (record as any).surgeryRecord = surgeryRecord;
    if (pregnancyRecord !== undefined) (record as any).pregnancyRecord = pregnancyRecord;
    if (pregnancyDelivery !== undefined) (record as any).pregnancyDelivery = pregnancyDelivery;
    if (sharedWithOwner !== undefined) record.sharedWithOwner = sharedWithOwner;
    if (stage !== undefined) record.stage = stage;
    if (chiefComplaint !== undefined) record.chiefComplaint = chiefComplaint;
    if (subjective !== undefined) record.subjective = subjective;
    if (assessment !== undefined) record.assessment = assessment;
    if (plan !== undefined) record.plan = plan;
    if (medications !== undefined) record.medications = medications;
    if (diagnosticTests !== undefined) record.diagnosticTests = diagnosticTests;
    if (preventiveCare !== undefined) record.preventiveCare = preventiveCare;
    if (confinementAction !== undefined) record.confinementAction = confinementAction;
    if (confinementDays !== undefined) record.confinementDays = confinementDays;
    if (referral !== undefined) record.referral = referral;
    if (discharge !== undefined) record.discharge = discharge;
    if (scheduledSurgery !== undefined) record.scheduledSurgery = scheduledSurgery;

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

    // If marking the record as completed, auto-schedule appointments for preventive care items
    if (stage === 'completed' && preventiveCare && preventiveCare.length > 0) {
      try {
        await autoSchedulePreventiveCareAppointments(record, preventiveCare, req.user.userId);
      } catch (pcErr) {
        console.error('[MedicalRecord] Error auto-scheduling preventive care appointments:', pcErr);
        // Don't block the visit completion on preventive care scheduling error
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
        }
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
          pregnancyStatus: pet.pregnancyStatus,
        },
        operations,
        medications,
        chiefComplaint,
        latestSOAP,
        vaccinations: formattedVaccinations,
        pregnancyRecords,
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
