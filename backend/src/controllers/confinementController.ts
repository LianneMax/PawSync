import { Request, Response } from 'express';
import ConfinementRecord from '../models/ConfinementRecord';
import User from '../models/User';
import Pet from '../models/Pet';
import MedicalRecord from '../models/MedicalRecord';
import { createNotification } from '../services/notificationService';
import {
  sendConfinementReleaseRequestToVet,
  sendConfinementReleaseConfirmedToOwner,
} from '../services/emailService';

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
