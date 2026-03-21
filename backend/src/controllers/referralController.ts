import { Request, Response } from 'express';
import Referral from '../models/Referral';
import Pet from '../models/Pet';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import MedicalRecord from '../models/MedicalRecord';
import { sendReferralToVet, sendReferralToOwner } from '../services/emailService';

/**
 * POST /api/referrals
 * Create a care-plan referral from a medical record visit.
 * Storing the Referral document is the access grant — getHistoricalRecords and
 * getMedicalHistory check for an active referral to authorise the referred vet.
 * Emails are sent non-blocking to the referred vet and pet owner.
 */
export const createReferral = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    if (req.user.userType !== 'veterinarian' && req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Only vets and clinic staff can create referrals' });
    }

    const { petId, medicalRecordId, referredVetId, referredBranchId, referringBranchId, reason } = req.body;

    if (!petId || !medicalRecordId || !referredVetId || !referredBranchId || !referringBranchId || !reason?.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'All fields are required' });
    }

    if (referredVetId === req.user.userId) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot refer to yourself' });
    }

    const [pet, record, referredVet, referredBranch, referringBranch] = await Promise.all([
      Pet.findById(petId).lean(),
      MedicalRecord.findById(medicalRecordId).lean(),
      User.findById(referredVetId).select('firstName lastName email userType').lean(),
      ClinicBranch.findById(referredBranchId).select('name').lean(),
      ClinicBranch.findById(referringBranchId).select('name').lean(),
    ]);

    if (!pet) return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Medical record not found' });
    if (!referredVet || referredVet.userType !== 'veterinarian') {
      return res.status(404).json({ status: 'ERROR', message: 'Referred vet not found' });
    }
    if (!referredBranch) return res.status(404).json({ status: 'ERROR', message: 'Referred branch not found' });
    if (!referringBranch) return res.status(404).json({ status: 'ERROR', message: 'Referring branch not found' });

    const referringVet = await User.findById(req.user.userId).select('firstName lastName').lean();
    const referringVetName = referringVet
      ? `${referringVet.firstName} ${referringVet.lastName}`
      : 'Your veterinarian';

    const owner = await User.findById((pet as any).ownerId).select('firstName lastName email').lean();

    const referral = await Referral.create({
      petId,
      medicalRecordId,
      referringVetId: req.user.userId,
      referredVetId,
      referringBranchId,
      referredBranchId,
      reason: reason.trim(),
      status: 'pending',
    });

    // Fire emails non-blocking — failure must not fail the referral itself
    Promise.all([
      sendReferralToVet({
        referredVetEmail: referredVet.email,
        referredVetFirstName: referredVet.firstName,
        referringVetName,
        referringBranchName: (referringBranch as any).name,
        referredBranchName: (referredBranch as any).name,
        ownerName: owner ? `${(owner as any).firstName} ${(owner as any).lastName}` : 'the pet owner',
        petName: (pet as any).name,
        petId: petId.toString(),
        reason: reason.trim(),
      }),
      (owner as any)?.email
        ? sendReferralToOwner({
            ownerEmail: (owner as any).email,
            ownerFirstName: (owner as any).firstName,
            petName: (pet as any).name,
            referringVetName,
            referredVetName: `${referredVet.firstName} ${referredVet.lastName}`,
            referredBranchName: (referredBranch as any).name,
          })
        : Promise.resolve(),
    ]).catch((err) => console.error('[Referral] Email send error:', err));

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Referral created and medical history shared',
      data: { referral },
    });
  } catch (error) {
    console.error('Create referral error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the referral' });
  }
};
