import { Request, Response } from 'express';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import AssignedVet from '../models/AssignedVet';

/**
 * Create a new medical record
 */
export const createMedicalRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId, clinicId, clinicBranchId, vitals, images, overallObservation } = req.body;

    // Verify the pet exists
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Parse base64 images into Buffers
    const parsedImages = (images || []).map((img: { data: string; contentType: string; description?: string }) => ({
      data: Buffer.from(img.data, 'base64'),
      contentType: img.contentType,
      description: img.description || ''
    }));

    const record = await MedicalRecord.create({
      petId,
      vetId: req.user.userId,
      clinicId,
      clinicBranchId,
      vitals,
      images: parsedImages,
      overallObservation: overallObservation || ''
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Medical record created successfully',
      data: { record: { ...record.toObject(), images: (record.toObject().images || []).map((img: any) => ({ _id: img._id, contentType: img.contentType, description: img.description })) } }
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
 * Get all medical records for a pet
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

    // Pet owner can view their own pet's records; vet can view if assigned
    const isOwner = pet.ownerId.toString() === req.user.userId;
    let isAssignedVet = false;

    if (req.user.userType === 'veterinarian') {
      const assignment = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      isAssignedVet = !!assignment;
    }

    const isClinicAdmin = req.user.userType === 'clinic-admin';

    if (!isOwner && !isAssignedVet && !isClinicAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view these records' });
    }

    const records = await MedicalRecord.find({ petId: req.params.petId })
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
    console.error('Get records error:', error);
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
      .populate('clinicBranchId', 'name address phone');

    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    const pet = record.petId as any;
    const isOwner = pet.ownerId?.toString() === req.user.userId;
    const isRecordVet = record.vetId && (record.vetId as any)._id?.toString() === req.user.userId;
    const isClinicAdmin = req.user.userType === 'clinic-admin';

    if (!isOwner && !isRecordVet && !isClinicAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this record' });
    }

    // Convert image buffers to base64 for frontend
    const recordObj = record.toObject();
    recordObj.images = recordObj.images.map((img: any) => ({
      _id: img._id,
      data: img.data ? img.data.toString('base64') : null,
      contentType: img.contentType,
      description: img.description
    }));

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
 * Update a medical record (only the vet who created it)
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

    if (record.vetId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Only the attending vet can update this record' });
    }

    const { vitals, images, overallObservation } = req.body;

    if (vitals) record.vitals = vitals;
    if (overallObservation !== undefined) record.overallObservation = overallObservation;

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
      data: { record: { ...record.toObject(), images: (record.toObject().images || []).map((img: any) => ({ _id: img._id, contentType: img.contentType, description: img.description })) } }
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
 * Delete a medical record
 */
export const deleteRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    }

    // Only the attending vet or clinic admin can delete
    if (record.vetId.toString() !== req.user.userId && req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to delete this record' });
    }

    await record.deleteOne();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Medical record deleted successfully'
    });
  } catch (error) {
    console.error('Delete record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting the record' });
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
