import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Pet from '../models/Pet';
import User from '../models/User';
import AssignedVet from '../models/AssignedVet';
import MedicalRecord from '../models/MedicalRecord';
import Vaccination from '../models/Vaccination';
import QRCode from 'qrcode';
import { sendLostPetConfirmation, sendLostPetScanAlert } from '../services/emailService';
import { createNotification } from '../services/notificationService';

/** Decode JWT from Authorization header without failing if absent/invalid */
const tryDecodeToken = (req: Request): { userId: string } | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your-secret-key') as any;
  } catch {
    return null;
  }
};

/**
 * Generate QR code for a pet profile
 */
const generateQRCodeForPet = async (petId: string, baseUrl: string): Promise<string> => {
  try {
    const petProfileUrl = `${baseUrl}/pet/${petId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(petProfileUrl, {
      errorCorrectionLevel: 'H' as any,
      type: 'image/png',
      width: 300,
      margin: 1,
    } as any);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

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

    // Generate QR code for the pet profile
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrCode = await generateQRCodeForPet(pet._id.toString(), baseUrl);
      pet.qrCode = qrCode;
      await pet.save();
      console.log(`[Pet] QR code generated for pet ${pet._id}`);
    } catch (qrError) {
      console.error('[Pet] Failed to generate QR code:', qrError);
      // Continue even if QR code generation fails
    }

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

    // Only the owner, an authorized vet, or a clinic/branch admin can view the pet
    const isOwner = pet.ownerId._id.toString() === req.user.userId;
    const isClinicAdmin = req.user.userType === 'clinic-admin' || req.user.userType === 'branch-admin';
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const vetPet = await AssignedVet.findOne({ vetId: req.user.userId, petId: pet._id, isActive: true });
      isAuthorizedVet = !!vetPet;
      if (!isAuthorizedVet) {
        const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
        isAuthorizedVet = !!hasRecords;
      }
    }

    if (!isOwner && !isAuthorizedVet && !isClinicAdmin) {
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

    const wasLost = pet.isLost;

    const allowedFields = [
      'name', 'species', 'breed', 'secondaryBreed', 'sex',
      'dateOfBirth', 'weight', 'sterilization', 'microchipNumber',
      'nfcTagId', 'photo', 'notes', 'allergies', 'isLost', 'isConfined'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (pet as any)[field] = req.body[field];
      }
    }

    await pet.save();

    // Send lost pet confirmation when owner first marks pet as lost
    if (!wasLost && pet.isLost) {
      Promise.resolve().then(async () => {
        await createNotification(
          req.user!.userId,
          'pet_lost',
          'Pet Reported as Lost',
          `${pet.name} has been marked as lost. Their public profile is now active — anyone who scans their tag can contact you.`,
          { petId: pet._id }
        );
        const owner = await User.findById(req.user!.userId).select('firstName email');
        if (owner?.email) {
          sendLostPetConfirmation({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet.name,
            petId: (pet._id as any).toString(),
            species: pet.species,
          });
        }
      }).catch((err) => console.error('[Notification] Lost pet notification error:', err));
    }

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
 * Get public pet profile (no auth - for QR/NFC scanning)
 */
export const getPublicPetProfile = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.id)
      .select('name species breed secondaryBreed sex dateOfBirth weight photo allergies isLost lostReportedByStranger scanLocations ownerId')
      .populate('ownerId', 'firstName lastName contactNumber');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Get latest medical record for vitals
    const latestRecord = await MedicalRecord.findOne({ petId: pet._id })
      .sort({ createdAt: -1 })
      .select('vitals.weight vitals.temperature vitals.pulseRate vitals.spo2 createdAt');

    // Get vaccination records (exclude declined and pending-only drafts)
    const vaccinations = await Vaccination.find({
      petId: pet._id,
      status: { $ne: 'declined' },
    })
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ dateAdministered: -1 });

    // Compute overall vaccination status from the new status field
    const activeVax = vaccinations.filter(v => v.status === 'active');
    const overdueVax = vaccinations.filter(v => v.status === 'overdue' || v.status === 'expired');
    let vaccinationStatus: 'none' | 'up_to_date' | 'overdue' = 'none';
    if (vaccinations.length > 0) {
      vaccinationStatus = overdueVax.length > 0 ? 'overdue' : 'up_to_date';
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
          photo: pet.photo,
          allergies: pet.allergies,
          isLost: pet.isLost,
          lostReportedByStranger: pet.lostReportedByStranger,
          scanLocations: pet.scanLocations ?? [],
        },
        owner: pet.ownerId,
        vitals: latestRecord ? {
          weight: latestRecord.vitals.weight,
          temperature: latestRecord.vitals.temperature,
          pulseRate: latestRecord.vitals.pulseRate,
          spo2: latestRecord.vitals.spo2,
          recordedAt: latestRecord.createdAt,
        } : null,
        vaccinations: vaccinations.map(v => ({
          _id: v._id,
          vaccineName: v.vaccineName,
          manufacturer: v.manufacturer,
          batchNumber: v.batchNumber,
          route: v.route,
          dateAdministered: v.dateAdministered,
          expiryDate: v.expiryDate,
          nextDueDate: v.nextDueDate,
          status: v.status,
          isUpToDate: v.isUpToDate,
          vet: v.vetId,
          clinic: v.clinicId,
        })),
        vaccinationStatus,
      }
    });
  } catch (error) {
    console.error('Get public pet profile error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Report a pet as missing (public - for scanners)
 */
export const reportPetMissing = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.isLost) {
      return res.status(200).json({ status: 'SUCCESS', message: 'This pet is already reported as missing' });
    }

    const decoded = tryDecodeToken(req);
    const isOwner = decoded?.userId === pet.ownerId.toString();

    pet.isLost = true;
    pet.lostReportedByStranger = !isOwner;

    // Capture stranger's geolocation as the first scan entry
    const { latitude, longitude } = req.body ?? {};
    let savedLocation: { lat: number; lng: number; scannedAt: Date } | null = null;
    if (!isOwner && typeof latitude === 'number' && typeof longitude === 'number') {
      const now = new Date();
      savedLocation = { lat: latitude, lng: longitude, scannedAt: now };
      pet.scanLocations.push(savedLocation);
      pet.lastScannedLat = latitude;
      pet.lastScannedLng = longitude;
      pet.lastScannedAt = now;
    }

    await pet.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Pet has been reported as missing. The owner will be notified.',
      scanLocation: savedLocation,
    });
  } catch (error) {
    console.error('Report pet missing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
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

    // Return pet ID so frontend can redirect to public profile
    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        petId: pet._id,
        name: pet.name,
        isLost: pet.isLost,
      }
    });
  } catch (error) {
    console.error('Get pet by NFC error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Update a pet's confinement status.
 * Accessible by: pet owner OR a vet who has treated this pet.
 */
export const updatePetConfinement = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const isOwner = pet.ownerId.toString() === req.user.userId;
    const isClinicAdmin = req.user.userType === 'clinic-admin' || req.user.userType === 'branch-admin';
    let isAuthorizedVet = false;

    if (req.user.userType === 'veterinarian') {
      const hasRecords = await MedicalRecord.exists({ vetId: req.user.userId, petId: pet._id });
      isAuthorizedVet = !!hasRecords;
    }

    if (!isOwner && !isAuthorizedVet && !isClinicAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to update this pet\'s confinement status' });
    }

    const { isConfined } = req.body;
    if (typeof isConfined !== 'boolean') {
      return res.status(400).json({ status: 'ERROR', message: 'isConfined must be a boolean' });
    }

    pet.isConfined = isConfined;
    let confinementDays = 0;
    if (isConfined) {
      pet.confinedSince = new Date();
    } else {
      if (pet.confinedSince) {
        const msPerDay = 1000 * 60 * 60 * 24;
        confinementDays = Math.max(1, Math.ceil((Date.now() - pet.confinedSince.getTime()) / msPerDay));
      }
      pet.confinedSince = null;
    }
    await pet.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: isConfined ? 'Pet marked as confined' : 'Pet released from confinement',
      data: { pet, confinementDays }
    });
  } catch (error) {
    console.error('Update pet confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating confinement status' });
  }
};

/**
 * POST /api/pets/:id/scan-alert (public - no auth)
 * Called by the public pet profile page when a lost pet's QR is scanned.
 * Notifies the owner that someone viewed their lost pet's profile.
 */
export const scanPetAlert = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('ownerId', 'firstName email');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.isLost) {
      const owner = pet.ownerId as any;
      if (owner?.email) {
        sendLostPetScanAlert({
          ownerEmail: owner.email,
          ownerFirstName: owner.firstName,
          petName: pet.name,
          petId: (pet._id as any).toString(),
        });
      }
    }

    return res.status(200).json({ status: 'SUCCESS', isLost: pet.isLost });
  } catch (error) {
    console.error('Scan pet alert error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/pets/:id/report-found
 * Public endpoint — called when a finder shares their location on the public profile.
 * Saves the last scanned coordinates to the pet record.
 */
export const reportPetFound = async (req: Request, res: Response) => {
  try {
    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const { latitude, longitude } = req.body;

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const now = new Date();
      pet.scanLocations.push({ lat: latitude, lng: longitude, scannedAt: now });
      pet.lastScannedLat = latitude;
      pet.lastScannedLng = longitude;
      pet.lastScannedAt = now;
      await pet.save();
    }

    return res.status(200).json({ status: 'SUCCESS', message: 'Location recorded. The owner has been notified.' });
  } catch (error) {
    console.error('Report pet found error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
