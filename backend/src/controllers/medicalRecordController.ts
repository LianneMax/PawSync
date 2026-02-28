import { Request, Response } from 'express';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import AssignedVet from '../models/AssignedVet';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';

/**
 * Helper — returns true if req.user is a clinic-admin or branch-admin.
 */
function isClinicAdminUser(req: Request): boolean {
  return req.user?.userType === 'clinic-admin' || req.user?.userType === 'branch-admin';
}

/**
 * Create a new medical record.
 * Accessible by: veterinarian, clinic-admin, branch-admin.
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
    if (isOwner && !isAuthorizedVet && !isAdmin) {
      query.sharedWithOwner = true;
    }

    const currentRecord = await MedicalRecord.findOne({ ...query, isCurrent: true })
      .select('-images.data -vetNotes')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address');

    const historicalRecords = await MedicalRecord.find({ ...query, isCurrent: false })
      .select('-images.data')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
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
    if (isOwner && !isAuthorizedVet && !isAdmin) {
      query.sharedWithOwner = true;
    }

    const record = await MedicalRecord.findOne(query)
      .select('-images.data')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address');

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
      .populate('petId', 'name species breed sex dateOfBirth weight photo ownerId')
      .populate('vetId', 'firstName lastName email')
      .populate('clinicId', 'name address phone email adminId')
      .populate('clinicBranchId', 'name address phone')
      .populate('appointmentId', 'date startTime endTime types status');

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
 * Accessible by: veterinarian, clinic-admin, branch-admin.
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
    } else if (isClinicAdminUser(req)) {
      query.clinicId = req.user.clinicId;
    }

    if (petId) query.petId = petId;

    const records = await MedicalRecord.find(query)
      .select('-images.data -vetNotes')
      .populate('petId', 'name species breed photo')
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
 * Accessible by: the creating vet OR clinic-admin/branch-admin.
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

    const { vitals, images, overallObservation, sharedWithOwner, visitSummary, vetNotes } = req.body;

    if (vitals) record.vitals = vitals;
    if (overallObservation !== undefined) record.overallObservation = overallObservation;
    if (visitSummary !== undefined) record.visitSummary = visitSummary;
    if (vetNotes !== undefined) record.vetNotes = vetNotes;
    if (sharedWithOwner !== undefined) record.sharedWithOwner = sharedWithOwner;

    if (images) {
      record.images = images.map((img: { data: string; contentType: string; description?: string }) => ({
        data: Buffer.from(img.data, 'base64'),
        contentType: img.contentType,
        description: img.description || ''
      }));
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
 * Accessible by: creating vet OR clinic-admin/branch-admin.
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
      .populate('vetId', 'firstName lastName')
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
