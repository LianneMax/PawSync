import { Request, Response } from 'express';
import crypto from 'crypto';
import Vaccination, { computeVaccinationStatus } from '../models/Vaccination';
import VaccineType from '../models/VaccineType';
import Pet from '../models/Pet';
import User from '../models/User';
import AssignedVet from '../models/AssignedVet';
import MedicalRecord from '../models/MedicalRecord';
import Appointment from '../models/Appointment';
import ClinicBranch from '../models/ClinicBranch';
import { createNotification } from '../services/notificationService';
import { sendBoosterScheduledVet } from '../services/emailService';

/**
 * Helper: add days to a date, returns a new Date.
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Helper: add minutes to a "HH:MM" time string.
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

/**
 * Helper: get the booster interval for a specific dose number.
 * Uses boosterIntervalDaysList[doseNumber - 1] when available, falls back to boosterIntervalDays.
 * doseNumber is the dose being ADMINISTERED (so we want the interval to the NEXT dose).
 */
function getIntervalForDose(vaccineType: { boosterIntervalDays: number | null; boosterIntervalDaysList?: number[] }, doseNumber: number): number | null {
  const list = vaccineType.boosterIntervalDaysList;
  if (list && list.length > 0) {
    // index = doseNumber - 1 (dose 1 → index 0, dose 2 → index 1, ...)
    const interval = list[doseNumber - 1];
    if (interval != null) return interval;
  }
  return vaccineType.boosterIntervalDays ?? null;
}

/**
 * Helper: compute pet age in months from dateOfBirth.
 */
function petAgeInMonths(dateOfBirth: Date): number {
  const now = new Date();
  return (now.getFullYear() - dateOfBirth.getFullYear()) * 12 +
    (now.getMonth() - dateOfBirth.getMonth());
}

/**
 * Refresh status for a list of vaccination docs and save if changed.
 * Used on GET so expired/overdue records reflect current date.
 */
async function refreshStatuses(vaccinations: any[]): Promise<any[]> {
  const savePromises: Promise<any>[] = [];

  for (const vax of vaccinations) {
    const computed = computeVaccinationStatus(vax);
    if (computed !== vax.status) {
      vax.status = computed;
      vax.isUpToDate = computed === 'active';
      savePromises.push(vax.save());
    }
  }

  if (savePromises.length > 0) {
    await Promise.all(savePromises);
  }

  return vaccinations;
}

/**
 * POST /api/vaccinations
 * Veterinarian or clinic-admin — record a new vaccination.
 *
 * Business Rules:
 *  BR-VAX-01: vetId defaults to the logged-in vet; clinic-admins may supply a vetId in the body.
 *  BR-VAX-02: vaccineTypeId is required; name, expiry date, and next due date are auto-computed.
 *  BR-VAX-03: dateAdministered cannot be in the future.
 *  BR-VAX-04: If appointmentId is provided, vaccination is linked to that appointment.
 *  BR-VAX-05: If medicalRecordId is provided, vaccination is linked to that medical record.
 */
export const createVaccination = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      petId,
      vaccineTypeId,
      manufacturer,
      batchNumber,
      route,
      dateAdministered,
      notes,
      nextDueDate,
      clinicId,
      clinicBranchId,
      appointmentId,
      medicalRecordId,
    } = req.body;

    const doseNumber = req.body.doseNumber ? Number(req.body.doseNumber) : 1;

    // BR-VAX-01: resolve vetId
    const vetId = req.body.vetId || req.user.userId;

    // Validate pet
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Load vaccine type + compute dates
    const vaccineType = await VaccineType.findById(vaccineTypeId);
    if (!vaccineType) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccine type not found' });
    }

    // BR-VAX-AGE: Validate pet age against vaccine type age requirements
    if (pet.dateOfBirth) {
      const ageMonths = petAgeInMonths(pet.dateOfBirth);
      if (vaccineType.minAgeMonths && ageMonths < vaccineType.minAgeMonths) {
        const ageWeeks = Math.round(ageMonths * 4.3);
        const minWeeks = Math.round(vaccineType.minAgeMonths * 4.3);
        return res.status(400).json({
          status: 'ERROR',
          message: `Pet is too young for this vaccine (${ageWeeks} weeks old). Minimum age required: ${minWeeks} weeks (${vaccineType.minAgeMonths} months).`,
        });
      }
      if (vaccineType.maxAgeMonths && ageMonths > vaccineType.maxAgeMonths) {
        const ageWeeks = Math.round(ageMonths * 4.3);
        const maxWeeks = Math.round(vaccineType.maxAgeMonths * 4.3);
        return res.status(400).json({
          status: 'ERROR',
          message: `Pet exceeds maximum age for this vaccine (${ageWeeks} weeks old). Maximum age allowed: ${maxWeeks} weeks (${vaccineType.maxAgeMonths} months).`,
        });
      }
    }

    // BR-VAX-03: date cannot be in the future
    const adminDate = dateAdministered ? new Date(dateAdministered) : new Date();
    if (adminDate > new Date()) {
      return res.status(400).json({ status: 'ERROR', message: 'Date administered cannot be in the future' });
    }

    const expiryDate = addDays(adminDate, vaccineType.validityDays);
    const totalDoses = (vaccineType.numberOfBoosters || 0) + 1;
    const isLastDose = doseNumber >= totalDoses;
    
    // Use provided nextDueDate if available, otherwise auto-calculate using per-dose interval
    let computedNextDueDate: Date | null = null;
    if (nextDueDate) {
      computedNextDueDate = new Date(nextDueDate);
    } else if (vaccineType.requiresBooster && !isLastDose) {
      const interval = getIntervalForDose(vaccineType, doseNumber);
      if (interval) computedNextDueDate = addDays(adminDate, interval);
    }

    // Resolve clinicId/clinicBranchId — priority: body → JWT → appointmentId lookup → vet user doc
    let resolvedCreateClinicId: any = clinicId || req.user.clinicId;
    let resolvedCreateBranchId: any = clinicBranchId || req.user.clinicBranchId || null;

    if (!resolvedCreateClinicId && appointmentId) {
      const appt = await Appointment.findById(appointmentId).select('clinicId clinicBranchId').lean();
      if (appt) {
        resolvedCreateClinicId = appt.clinicId;
        resolvedCreateBranchId = resolvedCreateBranchId || appt.clinicBranchId || null;
      }
    }

    if (!resolvedCreateClinicId) {
      const vetUser = await User.findById(vetId).select('clinicId clinicBranchId').lean();
      resolvedCreateClinicId = vetUser?.clinicId || null;
      resolvedCreateBranchId = resolvedCreateBranchId || vetUser?.clinicBranchId || null;
    }

    // If a record for the same pet + vaccine type already exists, update it
    // instead of creating a duplicate — just increment doseNumber and refresh dates.
    const existing = await Vaccination.findOne({
      petId,
      vaccineTypeId,
    });

    if (existing) {
      existing.vetId = vetId;
      existing.clinicId = resolvedCreateClinicId;
      existing.clinicBranchId = resolvedCreateBranchId;
      existing.manufacturer = manufacturer || existing.manufacturer;
      existing.batchNumber = batchNumber || existing.batchNumber;
      existing.route = route || vaccineType.route || existing.route;
      existing.dateAdministered = adminDate;
      existing.expiryDate = expiryDate;
      existing.nextDueDate = computedNextDueDate;
      existing.doseNumber = existing.doseNumber + 1;
      existing.notes = notes || existing.notes;
      if (appointmentId) existing.appointmentId = appointmentId;
      if (medicalRecordId) existing.medicalRecordId = medicalRecordId;

      await existing.save();

      return res.status(200).json({
        status: 'SUCCESS',
        message: `Vaccination updated (dose ${existing.doseNumber})`,
        data: { vaccination: existing },
      });
    }

    const vaccination = await Vaccination.create({
      petId,
      vetId,
      clinicId: resolvedCreateClinicId,
      clinicBranchId: resolvedCreateBranchId,
      vaccineTypeId,
      vaccineName: vaccineType.name,
      manufacturer: manufacturer || '',
      batchNumber: batchNumber || '',
      route: route || vaccineType.route || null,
      dateAdministered: adminDate,
      expiryDate,
      nextDueDate: computedNextDueDate,
      doseNumber,
      notes: notes || '',
      appointmentId: appointmentId || null,
      medicalRecordId: medicalRecordId || null,
    });

    // Generate a unique verify token
    vaccination.verifyToken = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'pawsync-secret')
      .update(vaccination._id.toString() + vaccination.createdAt.toString())
      .digest('hex')
      .substring(0, 24);
    await vaccination.save();

    // Auto-schedule the next booster appointment if a nextDueDate was computed
    let boosterAppointmentId: string | undefined;
    if (computedNextDueDate) {
      const boosterDate = new Date(computedNextDueDate);
      boosterDate.setUTCHours(0, 0, 0, 0);

      // Use the just-created vaccination's clinicId/clinicBranchId — already resolved correctly
      const resolvedClinicId = vaccination.clinicId;

      // clinicBranchId is required on Appointment — try vaccination first, then vet's user doc, then first branch
      let resolvedBranchId: string | null = vaccination.clinicBranchId
        ? vaccination.clinicBranchId.toString()
        : null;

      if (!resolvedBranchId) {
        const vetUser = await User.findById(vetId).select('clinicBranchId').lean();
        if (vetUser?.clinicBranchId) {
          resolvedBranchId = vetUser.clinicBranchId.toString();
        } else if (resolvedClinicId) {
          const branch = await ClinicBranch.findOne({ clinicId: resolvedClinicId }).select('_id').lean();
          if (branch) resolvedBranchId = branch._id.toString();
        }
      }

      if (!resolvedClinicId || !resolvedBranchId) {
        console.error('[AutoBooster] Cannot auto-schedule booster: clinicId or clinicBranchId could not be resolved');
      } else {
        // Try several time slots to avoid double-booking
        const candidateSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
        for (const startTime of candidateSlots) {
          const endTime = addMinutesToTime(startTime, 30);
          try {
            const boosterAppt = await Appointment.create({
              petId,
              ownerId: pet.ownerId,
              vetId,
              clinicId: resolvedClinicId,
              clinicBranchId: resolvedBranchId,
              mode: 'face-to-face',
              types: ['vaccination'],
              date: boosterDate,
              startTime,
              endTime,
              status: 'confirmed',
              notes: `Auto-scheduled dose ${doseNumber + 1} of ${totalDoses} for ${vaccineType.name}`,
            });
            boosterAppointmentId = boosterAppt._id.toString();
            break;
          } catch (slotErr: any) {
            // Only continue looping for duplicate key (slot conflict); break on any other error
            if (slotErr?.code === 11000) continue;
            console.error('[AutoBooster] Appointment creation error:', slotErr);
            break;
          }
        }

        if (!boosterAppointmentId) {
          console.error('[AutoBooster] All candidate slots were taken — booster not scheduled');
        } else {
          // Link booster appointment back to the vaccination record
          await Vaccination.findByIdAndUpdate(vaccination._id, { boosterAppointmentId });
        }
      }

      // Notify the pet owner and vet about the scheduled booster
      if (boosterAppointmentId) {
        const boosterDateStr = boosterDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        try {
          await createNotification(
            pet.ownerId.toString(),
            'appointment_scheduled',
            'Booster Appointment Scheduled',
            `A booster appointment for ${vaccineType.name} has been automatically confirmed for ${boosterDateStr}.`,
            { appointmentId: boosterAppointmentId, vaccineName: vaccineType.name }
          );
        } catch (notifErr) {
          console.error('[Notification] Booster appointment owner notification error:', notifErr);
        }

        // Notify the vet
        try {
          await createNotification(
            vetId.toString(),
            'appointment_scheduled',
            'Booster Appointment Scheduled',
            `A booster appointment for ${vaccineType.name} has been auto-scheduled for ${pet.name} on ${boosterDateStr}.`,
            { appointmentId: boosterAppointmentId, vaccineName: vaccineType.name, petId }
          );
          // Send email to vet
          const vet = await User.findById(vetId).select('firstName lastName email');
          const owner = await User.findById(pet.ownerId).select('firstName lastName');
          if (vet?.email && owner) {
            await sendBoosterScheduledVet({
              vetEmail: vet.email,
              vetFirstName: vet.firstName,
              petName: pet.name,
              ownerName: `${owner.firstName} ${owner.lastName}`,
              vaccineName: vaccineType.name,
              boosterDate,
            });
          }
        } catch (notifErr) {
          console.error('[Notification] Booster appointment vet notification error:', notifErr);
        }
      }
    }

    const populated = await Vaccination.findById(vaccination._id)
      .populate('vaccineTypeId', 'name species validityDays requiresBooster')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name');

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Vaccination recorded successfully',
      data: {
        vaccination: populated,
        ...(boosterAppointmentId ? { boosterAppointmentId, boosterDate: nextDueDate } : {}),
      },
    });
  } catch (error: any) {
    console.error('Create vaccination error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while recording the vaccination' });
  }
};

/**
 * GET /api/vaccinations/pet/:petId
 * Auth required — returns vaccinations for a pet with refreshed statuses.
 * Accessible by pet owner, assigned vet, clinic admin/branch admin.
 */
export const getVaccinationsByPet = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Auth check (only if authenticated)
    if (req.user) {
      const isOwner = pet.ownerId.toString() === req.user.userId;
      const isClinicAdmin =
        req.user.userType === 'clinic-admin';
      let isAuthorizedVet = false;

      if (req.user.userType === 'veterinarian') {
        const assignment = await AssignedVet.findOne({
          vetId: req.user.userId,
          petId: pet._id,
          isActive: true,
        });
        if (assignment) {
          isAuthorizedVet = true;
        } else {
          const hasRecords = await MedicalRecord.exists({
            vetId: req.user.userId,
            petId: pet._id,
          });
          isAuthorizedVet = !!hasRecords;
          // Also allow vet to see their own vaccination records
          if (!isAuthorizedVet) {
            const hasVaxRecords = await Vaccination.exists({
              vetId: req.user.userId,
              petId: pet._id,
            });
            isAuthorizedVet = !!hasVaxRecords;
          }
        }
      }

      if (!isOwner && !isAuthorizedVet && !isClinicAdmin) {
        return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view these vaccinations' });
      }
    }

    const vaccinations = await Vaccination.find({ petId: req.params.petId })
      .populate('vaccineTypeId', 'name species validityDays requiresBooster numberOfBoosters doseVolumeMl')
      .populate('vetId', 'firstName lastName prcLicenseNumber licenseNumber')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .sort({ dateAdministered: -1 });

    await refreshStatuses(vaccinations);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations },
    });
  } catch (error) {
    console.error('Get vaccinations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccinations' });
  }
};

/**
 * GET /api/vaccinations/medical-record/:medicalRecordId
 * Auth required — returns all vaccinations linked to a specific medical record.
 */
export const getVaccinationsByMedicalRecord = async (req: Request, res: Response) => {
  try {
    const vaccinations = await Vaccination.find({ medicalRecordId: req.params.medicalRecordId })
      .populate('vaccineTypeId', 'name species validityDays requiresBooster')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .sort({ dateAdministered: -1 });

    await refreshStatuses(vaccinations);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations },
    });
  } catch (error) {
    console.error('Get vaccinations by medical record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccinations' });
  }
};

/**
 * GET /api/vaccinations/pet/:petId/public
 * No auth required — returns minimal public-safe vaccination data.
 */
export const getPublicVaccinationsByPet = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const vaccinations = await Vaccination.find({
      petId: req.params.petId,
    })
      .populate('vaccineTypeId', 'name species')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ dateAdministered: -1 });

    await refreshStatuses(vaccinations);

    const publicData = vaccinations.map((v) => ({
      _id: v._id,
      vaccineName: v.vaccineName,
      manufacturer: v.manufacturer,
      batchNumber: v.batchNumber,
      route: v.route,
      dateAdministered: v.dateAdministered,
      expiryDate: v.expiryDate,
      nextDueDate: v.nextDueDate,
      status: v.status,
      vet: v.vetId,
      clinic: v.clinicId,
    }));

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations: publicData },
    });
  } catch (error) {
    console.error('Get public vaccinations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/:id
 * Auth required.
 */
export const getVaccinationById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccination = await Vaccination.findById(req.params.id)
      .populate('vaccineTypeId', 'name species validityDays requiresBooster boosterIntervalDays route')
      .populate('vetId', 'firstName lastName email photo')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .populate('petId', 'name species breed photo');

    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccination record not found' });
    }

    // Refresh status
    const computed = computeVaccinationStatus(vaccination);
    if (computed !== vaccination.status) {
      vaccination.status = computed;
      vaccination.isUpToDate = computed === 'active';
      await vaccination.save();
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccination },
    });
  } catch (error) {
    console.error('Get vaccination error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the vaccination' });
  }
};

/**
 * PUT /api/vaccinations/:id
 * Veterinarian or clinic-admin — update a vaccination.
 *
 * Business Rule BR-VAX-06: Declined vaccinations cannot be edited.
 * Business Rule BR-VAX-07: Clinic admins can update any vaccination in their clinic.
 */
export const updateVaccination = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccination = await Vaccination.findById(req.params.id);
    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccination record not found' });
    }

    const {
      vaccineTypeId,
      manufacturer,
      batchNumber,
      route,
      dateAdministered,
      notes,
      nextDueDate,
      medicalRecordId,
    } = req.body;

    // Capture original nextDueDate before any mutations so we can detect changes later
    const originalNextDueDate = vaccination.nextDueDate ? new Date(vaccination.nextDueDate) : null;

    // If vaccine type changed, recompute dates
    if (vaccineTypeId && vaccineTypeId.toString() !== vaccination.vaccineTypeId?.toString()) {
      const vaccineType = await VaccineType.findById(vaccineTypeId);
      if (!vaccineType) {
        return res.status(404).json({ status: 'ERROR', message: 'Vaccine type not found' });
      }
      const adminDate = dateAdministered ? new Date(dateAdministered) : vaccination.dateAdministered || new Date();
      vaccination.vaccineTypeId = vaccineTypeId;
      vaccination.vaccineName = vaccineType.name;
      vaccination.expiryDate = addDays(adminDate, vaccineType.validityDays);
      // Use provided nextDueDate if available, otherwise auto-calculate using per-dose interval
      if (nextDueDate) {
        vaccination.nextDueDate = new Date(nextDueDate);
      } else {
        const interval = getIntervalForDose(vaccineType, vaccination.doseNumber || 1);
        vaccination.nextDueDate = vaccineType.requiresBooster && interval ? addDays(adminDate, interval) : null;
      }
      vaccination.dateAdministered = adminDate;
    } else if (dateAdministered) {
      // Date changed but vaccine type is the same — recompute dates with same type
      const vaccineType = await VaccineType.findById(vaccination.vaccineTypeId);
      const adminDate = new Date(dateAdministered);
      vaccination.dateAdministered = adminDate;
      if (vaccineType) {
        vaccination.expiryDate = addDays(adminDate, vaccineType.validityDays);
        // Use provided nextDueDate if available, otherwise auto-calculate using per-dose interval
        if (nextDueDate) {
          vaccination.nextDueDate = new Date(nextDueDate);
        } else {
          const interval = getIntervalForDose(vaccineType, vaccination.doseNumber || 1);
          vaccination.nextDueDate = vaccineType.requiresBooster && interval ? addDays(adminDate, interval) : null;
        }
      }
    }

    if (manufacturer !== undefined) vaccination.manufacturer = manufacturer;
    if (batchNumber !== undefined) vaccination.batchNumber = batchNumber;
    if (route !== undefined) vaccination.route = (route || null) as typeof vaccination.route;
    if (notes !== undefined) vaccination.notes = notes;
    if (medicalRecordId !== undefined) vaccination.medicalRecordId = medicalRecordId || null;

    // If nextDueDate was explicitly provided and not yet applied (i.e. neither date-change branch ran), apply it now
    if (nextDueDate !== undefined && !dateAdministered && !(vaccineTypeId && vaccineTypeId.toString() !== vaccination.vaccineTypeId?.toString())) {
      vaccination.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    }

    // Detect whether nextDueDate actually changed vs the originally stored value
    const finalNextDueDate = vaccination.nextDueDate;
    const nextDueDateChanged =
      (originalNextDueDate === null && finalNextDueDate !== null) ||
      (originalNextDueDate !== null && finalNextDueDate === null) ||
      (originalNextDueDate !== null && finalNextDueDate !== null &&
        originalNextDueDate.toISOString() !== finalNextDueDate.toISOString());

    // If nextDueDate changed, update or delete the booster appointment
    if (nextDueDateChanged && vaccination.boosterAppointmentId) {
      // Delete the old booster appointment
      await Appointment.deleteOne({ _id: vaccination.boosterAppointmentId });
      vaccination.boosterAppointmentId = null;
    }

    // If nextDueDate is now set (either unchanged or changed), and no booster appointment exists, create one
    if (vaccination.nextDueDate && !vaccination.boosterAppointmentId) {
      const boosterDate = new Date(vaccination.nextDueDate);
      boosterDate.setUTCHours(0, 0, 0, 0);

      const resolvedClinicId = vaccination.clinicId;
      let resolvedBranchId: string | null = vaccination.clinicBranchId
        ? vaccination.clinicBranchId.toString()
        : null;

      if (!resolvedBranchId) {
        const vetUser = await User.findById(vaccination.vetId).select('clinicBranchId').lean();
        if (vetUser?.clinicBranchId) {
          resolvedBranchId = vetUser.clinicBranchId.toString();
        } else if (resolvedClinicId) {
          const branch = await ClinicBranch.findOne({ clinicId: resolvedClinicId }).select('_id').lean();
          if (branch) resolvedBranchId = branch._id.toString();
        }
      }

      if (resolvedClinicId && resolvedBranchId) {
        const candidateSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
        for (const startTime of candidateSlots) {
          const endTime = addMinutesToTime(startTime, 30);
          try {
            const vacType = await VaccineType.findById(vaccination.vaccineTypeId).select('name numberOfBoosters').lean();
            const totalDoses = (vacType?.numberOfBoosters || 0) + 1;
            
            const boosterAppt = await Appointment.create({
              petId: vaccination.petId,
              ownerId: (await Pet.findById(vaccination.petId).select('ownerId'))?.ownerId,
              vetId: vaccination.vetId,
              clinicId: resolvedClinicId,
              clinicBranchId: resolvedBranchId,
              mode: 'face-to-face',
              types: ['vaccination'],
              date: boosterDate,
              startTime,
              endTime,
              status: 'confirmed',
              notes: `Auto-scheduled booster for ${vaccination.vaccineName}`,
            });
            vaccination.boosterAppointmentId = boosterAppt._id;
            break;
          } catch (slotErr: any) {
            if (slotErr?.code === 11000) continue;
            console.error('[AutoBooster] Appointment creation error:', slotErr);
            break;
          }
        }
      }
    }

    await vaccination.save();

    const populated = await Vaccination.findById(vaccination._id)
      .populate('vaccineTypeId', 'name species validityDays requiresBooster')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name');

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Vaccination updated successfully',
      data: { vaccination: populated },
    });
  } catch (error) {
    console.error('Update vaccination error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the vaccination' });
  }
};


/**
 * DELETE /api/vaccinations/:id
 * Vet or clinic-admin only — permanently delete a vaccination record.
 */
export const deleteVaccination = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccination = await Vaccination.findById(req.params.id);
    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccination record not found' });
    }

    // Delete associated booster appointment if it exists
    if (vaccination.boosterAppointmentId) {
      await Appointment.deleteOne({ _id: vaccination.boosterAppointmentId });
    }

    await vaccination.deleteOne();

    return res.status(200).json({ status: 'SUCCESS', message: 'Vaccination record deleted' });
  } catch (error) {
    console.error('Delete vaccination error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/search/owners?q=
 * Vet / clinic admin — search pet owners by name for the vaccination form.
 */
export const searchOwners = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { q } = req.query;
    if (!q || (q as string).trim().length < 2) {
      return res.status(200).json({ status: 'SUCCESS', data: { owners: [] } });
    }

    const searchRegex = new RegExp((q as string).trim(), 'i');
    const owners = await User.find({
      userType: 'pet-owner',
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ],
    })
      .select('firstName lastName email')
      .limit(15)
      .sort({ firstName: 1 });

    return res.status(200).json({ status: 'SUCCESS', data: { owners } });
  } catch (error) {
    console.error('Search owners error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/search/pets?ownerId=
 * Vet / clinic admin — get pets for a specific owner.
 */
export const getPetsForOwner = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId is required' });
    }

    const pets = await Pet.find({ ownerId: ownerId as string })
      .select('name species breed photo dateOfBirth')
      .sort({ name: 1 });

    return res.status(200).json({ status: 'SUCCESS', data: { pets } });
  } catch (error) {
    console.error('Get pets for owner error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/vet/my-records
 * Veterinarian only — all vaccinations recorded by this vet.
 */
export const getVetVaccinations = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status, petId } = req.query;
    const query: any = { vetId: req.user.userId };

    if (status && status !== 'all') query.status = status;
    if (petId) query.petId = petId;

    const vaccinations = await Vaccination.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vaccineTypeId', 'name species')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .sort({ dateAdministered: -1 });

    await refreshStatuses(vaccinations);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations },
    });
  } catch (error) {
    console.error('Get vet vaccinations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccinations' });
  }
};

/**
 * GET /api/vaccinations/clinic/records
 * Clinic-admin / clinic-admin — all vaccinations in their clinic (or branch).
 *
 * Query params:
 *  - status: filter by vaccination status
 *  - petId: filter by pet
 *  - branchId: filter by branch (clinic-admin only)
 */
export const getClinicVaccinations = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status, petId, branchId } = req.query;
    const query: any = {};

    if (req.user.clinicId) {
      query.clinicId = req.user.clinicId;
    }
    // clinic-admin is scoped to their branch
    if (req.user.userType === 'clinic-admin' && req.user.clinicBranchId) {
      query.clinicBranchId = req.user.clinicBranchId;
    } else if (branchId) {
      query.clinicBranchId = branchId;
    }

    if (status && status !== 'all') query.status = status;
    if (petId) query.petId = petId;

    const vaccinations = await Vaccination.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vetId', 'firstName lastName')
      .populate('vaccineTypeId', 'name species')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .sort({ dateAdministered: -1 });

    await refreshStatuses(vaccinations);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccinations },
    });
  } catch (error) {
    console.error('Get clinic vaccinations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccinations' });
  }
};

/**
 * GET /api/vaccinations/verify/:token
 * Public — verify a vaccine record by its token (for QR scanning).
 */
export const verifyVaccinationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const vaccination = await Vaccination.findOne({ verifyToken: token })
      .populate('petId', 'name species breed photo')
      .populate('vaccineTypeId', 'name validityDays')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name');

    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Invalid or expired verification token' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccination },
    });
  } catch (error) {
    console.error('Verify vaccination error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/pet/:petId/upcoming
 * Returns upcoming vaccine due dates (next appointments) for a pet.
 * Includes both booster due dates AND expiry dates.
 * Auth required — accessible by pet owner, assigned vet, clinic staff.
 */
export const getUpcomingVaccineDates = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Auth check
    if (req.user) {
      const isOwner = pet.ownerId.toString() === req.user.userId;
      const isClinicAdmin = req.user.userType === 'clinic-admin';
      let isAuthorizedVet = false;

      if (req.user.userType === 'veterinarian') {
        const assignment = await AssignedVet.findOne({
          vetId: req.user.userId,
          petId: pet._id,
          isActive: true,
        });
        if (assignment) {
          isAuthorizedVet = true;
        } else {
          const hasRecords = await MedicalRecord.exists({
            vetId: req.user.userId,
            petId: pet._id,
          });
          isAuthorizedVet = !!hasRecords;
          if (!isAuthorizedVet) {
            const hasVaxRecords = await Vaccination.exists({
              vetId: req.user.userId,
              petId: pet._id,
            });
            isAuthorizedVet = !!hasVaxRecords;
          }
        }
      }

      if (!isOwner && !isAuthorizedVet && !isClinicAdmin) {
        return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this data' });
      }
    }

    // Get vaccinations with either nextDueDate OR expiryDate approaching
    const now = new Date();
    const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Look ahead 1 year

    const vaccinations = await Vaccination.find({
      petId: req.params.petId,
      $or: [
        {
          nextDueDate: { $exists: true, $ne: null, $gt: now },
        },
        {
          expiryDate: { $exists: true, $ne: null, $gt: now, $lt: futureDate },
          nextDueDate: { $in: [null, undefined] }, // Only if no booster scheduled
        },
      ],
    })
      .populate('vaccineTypeId', 'name requiresBooster boosterIntervalDays validityDays')
      .sort({ nextDueDate: 1, expiryDate: 1 });

    const upcomingDates = vaccinations.map((v) => {
      // Use nextDueDate if available (booster), otherwise use expiryDate
      const importantDate = v.nextDueDate || v.expiryDate;
      const dateType = v.nextDueDate ? 'booster_due' : 'expires';

      return {
        _id: v._id,
        petId: v.petId,
        vaccineName: v.vaccineName,
        nextDueDate: importantDate,
        expiryDate: v.expiryDate,
        lastAdministeredDate: v.dateAdministered,
        status: v.status,
        dateType, // 'booster_due' or 'expires'
        vaccineType: v.vaccineTypeId,
      };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { upcomingVaccines: upcomingDates },
    });
  } catch (error) {
    console.error('Get upcoming vaccines error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/vet/:vetId/upcoming-schedule
 * Returns upcoming vaccine schedules for all pets under a vet's care.
 * Includes both booster due dates AND expiry dates.
 * Auth required — accessible by the vet or clinic admins.
 */
export const getVetUpcomingVaccineSchedule = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vetId = req.params.vetId;
    
    // Auth check: only the vet or clinic admins can view this
    const isRequestingVet = req.user.userId === vetId;
    const isClinicAdmin = req.user.userType === 'clinic-admin';

    if (!isRequestingVet && !isClinicAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized' });
    }

    // Get all active vaccinations for this vet (with nextDueDate or approaching expiryDate)
    const now = new Date();
    const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Look ahead 1 year

    const vaccinations = await Vaccination.find({
      vetId: vetId,
      $or: [
        {
          nextDueDate: { $exists: true, $ne: null, $gt: now },
        },
        {
          expiryDate: { $exists: true, $ne: null, $gt: now, $lt: futureDate },
          nextDueDate: { $in: [null, undefined] },
        },
      ],
    })
      .populate('petId', 'name species breed photo ownerId')
      .populate('vaccineTypeId', 'name requiresBooster boosterIntervalDays validityDays')
      .populate('clinicId', 'name')
      .sort({ nextDueDate: 1, expiryDate: 1 });

    const upcomingSchedule = vaccinations.map((v) => {
      const importantDate = v.nextDueDate || v.expiryDate;
      const dateType = v.nextDueDate ? 'booster_due' : 'expires';

      return {
        _id: v._id,
        pet: {
          _id: v.petId._id,
          name: (v.petId as any).name,
          species: (v.petId as any).species,
          breed: (v.petId as any).breed,
          photo: (v.petId as any).photo,
          ownerId: (v.petId as any).ownerId,
        },
        vaccineName: v.vaccineName,
        nextDueDate: importantDate,
        expiryDate: v.expiryDate,
        lastAdministeredDate: v.dateAdministered,
        status: v.status,
        dateType,
        vaccineType: v.vaccineTypeId,
        clinic: v.clinicId,
      };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { upcomingSchedule },
    });
  } catch (error) {
    console.error('Get vet upcoming schedule error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/vaccinations/clinic/:clinicId/upcoming-schedule
 * Returns upcoming vaccine schedules for all pets in a clinic.
 * Includes both booster due dates AND expiry dates.
 * Auth required — clinic admin or branch admin only.
 */
export const getClinicUpcomingVaccineSchedule = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const isClinicAdmin = req.user.userType === 'clinic-admin';
    if (!isClinicAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Only clinic admins can access this' });
    }

    const clinicId = req.params.clinicId;

    // Get all active vaccinations for this clinic (with nextDueDate or approaching expiryDate)
    const now = new Date();
    const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Look ahead 1 year

    const vaccinations = await Vaccination.find({
      clinicId: clinicId,
      $or: [
        {
          nextDueDate: { $exists: true, $ne: null, $gt: now },
        },
        {
          expiryDate: { $exists: true, $ne: null, $gt: now, $lt: futureDate },
          nextDueDate: { $in: [null, undefined] },
        },
      ],
    })
      .populate('petId', 'name species breed photo ownerId')
      .populate('vetId', 'firstName lastName')
      .populate('vaccineTypeId', 'name requiresBooster boosterIntervalDays validityDays')
      .sort({ nextDueDate: 1, expiryDate: 1 });

    const upcomingSchedule = vaccinations.map((v) => {
      const importantDate = v.nextDueDate || v.expiryDate;
      const dateType = v.nextDueDate ? 'booster_due' : 'expires';

      return {
        _id: v._id,
        pet: {
          _id: v.petId._id,
          name: (v.petId as any).name,
          species: (v.petId as any).species,
          breed: (v.petId as any).breed,
          photo: (v.petId as any).photo,
          ownerId: (v.petId as any).ownerId,
        },
        vet: {
          _id: v.vetId._id,
          name: `${(v.vetId as any).firstName} ${(v.vetId as any).lastName}`,
        },
        vaccineName: v.vaccineName,
        nextDueDate: importantDate,
        expiryDate: v.expiryDate,
        lastAdministeredDate: v.dateAdministered,
        status: v.status,
        dateType,
        vaccineType: v.vaccineTypeId,
      };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { upcomingSchedule },
    });
  } catch (error) {
    console.error('Get clinic upcoming schedule error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
