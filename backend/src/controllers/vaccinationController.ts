import { Request, Response } from 'express';
import crypto from 'crypto';
import Vaccination, { computeVaccinationStatus } from '../models/Vaccination';
import VaccineType from '../models/VaccineType';
import Pet from '../models/Pet';
import User from '../models/User';
import AssignedVet from '../models/AssignedVet';
import MedicalRecord from '../models/MedicalRecord';

/**
 * Helper: add days to a date, returns a new Date.
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Refresh status for a list of vaccination docs and save if changed.
 * Used on GET so expired/overdue records reflect current date.
 */
async function refreshStatuses(vaccinations: any[]): Promise<any[]> {
  const savePromises: Promise<any>[] = [];

  for (const vax of vaccinations) {
    if (vax.status === 'declined') continue;
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
      clinicId,
      clinicBranchId,
      appointmentId,
      medicalRecordId,
    } = req.body;

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

    // BR-VAX-03: date cannot be in the future
    const adminDate = dateAdministered ? new Date(dateAdministered) : new Date();
    if (adminDate > new Date()) {
      return res.status(400).json({ status: 'ERROR', message: 'Date administered cannot be in the future' });
    }

    const expiryDate = addDays(adminDate, vaccineType.validityDays);
    const nextDueDate =
      vaccineType.requiresBooster && vaccineType.boosterIntervalDays
        ? addDays(adminDate, vaccineType.boosterIntervalDays)
        : null;

    const vaccination = await Vaccination.create({
      petId,
      vetId,
      clinicId: clinicId || req.user.clinicId,
      clinicBranchId: clinicBranchId || req.user.clinicBranchId || null,
      vaccineTypeId,
      vaccineName: vaccineType.name,
      manufacturer: manufacturer || '',
      batchNumber: batchNumber || '',
      route: route || vaccineType.route || null,
      dateAdministered: adminDate,
      expiryDate,
      nextDueDate,
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

    const populated = await Vaccination.findById(vaccination._id)
      .populate('vaccineTypeId', 'name species validityDays requiresBooster')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name');

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Vaccination recorded successfully',
      data: { vaccination: populated },
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
        req.user.userType === 'clinic-admin' || req.user.userType === 'branch-admin';
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
    console.error('Get vaccinations error:', error);
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
      status: { $ne: 'declined' },
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
      .populate('vaccineTypeId', 'name species validityDays requiresBooster')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name')
      .populate('petId', 'name species breed photo');

    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccination record not found' });
    }

    // Refresh status
    const computed = computeVaccinationStatus(vaccination);
    if (computed !== vaccination.status && vaccination.status !== 'declined') {
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
 * Veterinarian or clinic-admin — update a vaccination (not declined).
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

    if (vaccination.status === 'declined') {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot update a declined vaccination record' });
    }

    const {
      vaccineTypeId,
      manufacturer,
      batchNumber,
      route,
      dateAdministered,
      notes,
      medicalRecordId,
    } = req.body;

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
      vaccination.nextDueDate =
        vaccineType.requiresBooster && vaccineType.boosterIntervalDays
          ? addDays(adminDate, vaccineType.boosterIntervalDays)
          : null;
      vaccination.dateAdministered = adminDate;
    } else if (dateAdministered) {
      // Date changed but vaccine type is the same — recompute dates with same type
      const vaccineType = await VaccineType.findById(vaccination.vaccineTypeId);
      const adminDate = new Date(dateAdministered);
      vaccination.dateAdministered = adminDate;
      if (vaccineType) {
        vaccination.expiryDate = addDays(adminDate, vaccineType.validityDays);
        vaccination.nextDueDate =
          vaccineType.requiresBooster && vaccineType.boosterIntervalDays
            ? addDays(adminDate, vaccineType.boosterIntervalDays)
            : null;
      }
    }

    if (manufacturer !== undefined) vaccination.manufacturer = manufacturer;
    if (batchNumber !== undefined) vaccination.batchNumber = batchNumber;
    if (route !== undefined) vaccination.route = route;
    if (notes !== undefined) vaccination.notes = notes;
    if (medicalRecordId !== undefined) vaccination.medicalRecordId = medicalRecordId || null;

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
 * POST /api/vaccinations/:id/decline
 * Veterinarian or clinic-admin — mark a vaccination as declined.
 *
 * Business Rules:
 *  BR-VAX-08: A decline reason is required.
 *  BR-VAX-09: Declined status is permanent and cannot be reversed.
 *  BR-VAX-10: Declined vaccinations are hidden from the public NFC profile.
 */
export const declineVaccination = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccination = await Vaccination.findById(req.params.id);
    if (!vaccination) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccination record not found' });
    }

    if (vaccination.status === 'declined') {
      return res.status(400).json({ status: 'ERROR', message: 'This vaccination is already declined' });
    }

    vaccination.status = 'declined';
    vaccination.declinedReason = req.body.reason || null;
    vaccination.declinedBy = req.user.userId as any;
    vaccination.declinedAt = new Date();
    vaccination.isUpToDate = false;
    await vaccination.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Vaccination marked as declined',
      data: { vaccination },
    });
  } catch (error) {
    console.error('Decline vaccination error:', error);
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
      .select('name species breed photo')
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
 * Clinic-admin / branch-admin — all vaccinations in their clinic (or branch).
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
    // branch-admin is scoped to their branch
    if (req.user.userType === 'branch-admin' && req.user.clinicBranchId) {
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
