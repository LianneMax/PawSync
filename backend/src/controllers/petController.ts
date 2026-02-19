import { Request, Response } from 'express';
import Pet from '../models/Pet';
import User from '../models/User';
import AssignedVet from '../models/AssignedVet';

/**
 * Create a new pet
 */
export const createPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      name, species, breed, secondaryBreed, sex,
      dateOfBirth, weight, sterilization, microchipNumber,
      nfcTagId, photo, notes, allergies
    } = req.body;

    const pet = await Pet.create({
      ownerId: req.user.userId,
      name,
      species,
      breed,
      secondaryBreed: secondaryBreed || null,
      sex,
      dateOfBirth,
      weight,
      sterilization,
      microchipNumber: microchipNumber || null,
      nfcTagId: nfcTagId || null,
      photo: photo || null,
      notes: notes || null,
      allergies: allergies || []
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Pet created successfully',
      data: { pet }
    });
  } catch (error: any) {
    console.error('Create pet error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the pet' });
  }
};

/**
 * Get all pets for the authenticated user
 */
export const getMyPets = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pets = await Pet.find({ ownerId: req.user.userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { pets }
    });
  } catch (error) {
    console.error('Get pets error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching pets' });
  }
};

/**
 * Get a single pet by ID
 */
export const getPetById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.id).populate('ownerId', 'firstName lastName contactNumber email');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Only the owner or an assigned vet can view the pet
    const isOwner = pet.ownerId._id.toString() === req.user.userId;
    let isAssignedVet = false;

    if (req.user.userType === 'veterinarian') {
      const vetPet = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      isAssignedVet = !!vetPet;
    }

    if (!isOwner && !isAssignedVet) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this pet' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { pet }
    });
  } catch (error) {
    console.error('Get pet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the pet' });
  }
};

/**
 * Update a pet
 */
export const updatePet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to update this pet' });
    }

    const allowedFields = [
      'name', 'species', 'breed', 'secondaryBreed', 'sex',
      'dateOfBirth', 'weight', 'sterilization', 'microchipNumber',
      'nfcTagId', 'photo', 'notes', 'allergies', 'isLost'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (pet as any)[field] = req.body[field];
      }
    }

    await pet.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Pet updated successfully',
      data: { pet }
    });
  } catch (error: any) {
    console.error('Update pet error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the pet' });
  }
};

/**
 * Delete a pet (with optional removal reason)
 */
export const deletePet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to delete this pet' });
    }

    const { reason, details } = req.body || {};
    if (reason) {
      console.log(`[Pet Removed] Pet "${pet.name}" (${pet._id}) removed by user ${req.user.userId}. Reason: ${reason}${details ? ` — ${details}` : ''}`);
    }

    // Remove vet-pet relationships
    await AssignedVet.deleteMany({ petId: pet._id });
    await pet.deleteOne();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Pet deleted successfully'
    });
  } catch (error) {
    console.error('Delete pet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting the pet' });
  }
};

/**
 * Transfer pet ownership to another pet-owner
 */
export const transferPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { newOwnerEmail } = req.body;

    if (!newOwnerEmail) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide the new owner\'s email' });
    }

    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to transfer this pet' });
    }

    // Find the new owner
    const newOwner = await User.findOne({ email: newOwnerEmail.toLowerCase() });

    if (!newOwner) {
      return res.status(404).json({ status: 'ERROR', message: 'No account found with that email address' });
    }

    if (newOwner._id.toString() === req.user.userId) {
      return res.status(400).json({ status: 'ERROR', message: 'You cannot transfer a pet to yourself' });
    }

    if (newOwner.userType !== 'pet-owner') {
      return res.status(400).json({ status: 'ERROR', message: 'The recipient must have a pet-owner account' });
    }

    // Transfer ownership
    pet.ownerId = newOwner._id as any;
    await pet.save();

    // Remove existing vet assignments (don't carry over to new owner)
    await AssignedVet.deleteMany({ petId: pet._id });

    console.log(`[Pet Transferred] Pet "${pet.name}" (${pet._id}) transferred from user ${req.user.userId} to user ${newOwner._id}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Pet transferred successfully to ${newOwner.firstName} ${newOwner.lastName}`
    });
  } catch (error) {
    console.error('Transfer pet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while transferring the pet' });
  }
};

/**
 * Get pet by NFC tag ID (public - for scanning)
 */
export const getPetByNfc = async (req: Request, res: Response) => {
  try {
    const { nfcTagId } = req.params;

    const pet = await Pet.findOne({ nfcTagId }).populate('ownerId', 'firstName lastName email');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'No pet found with this NFC tag' });
    }

    // Return limited info for public scanning
    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        pet: {
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          sex: pet.sex,
          photo: pet.photo,
          isLost: pet.isLost,
          owner: pet.ownerId
        }
      }
    });
  } catch (error) {
    console.error('Get pet by NFC error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
