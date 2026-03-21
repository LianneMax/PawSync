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

    // Cross-branch referrals only — same-branch referrals are not allowed
    if (referredBranchId.toString() === referringBranchId.toString()) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot refer to a vet in the same branch' });
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

/**
 * GET /api/referrals/referred-pets
 * Returns all pets that have been referred to the requesting vet, with full
 * pet info, owner info, and branch/clinic info from the referral.
 * Used by patient-records to surface referred patients in the vet's patient list.
 *
 * Branch/clinic display context intentionally uses the REFERRING (originating) branch,
 * not the referred branch. This preserves the pet's original record ownership in the UI
 * and prevents the appearance of branch migration. The Referral document is the sole
 * access grant — no Pet or MedicalRecord fields are mutated.
 */
export const getReferredPets = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    if (req.user.userType !== 'veterinarian') {
      return res.status(403).json({ status: 'ERROR', message: 'Only veterinarians can view referred pets' });
    }

    const referrals = await Referral.find({ referredVetId: req.user.userId })
      .populate<{ petId: any }>({
        path: 'petId',
        populate: { path: 'ownerId', select: 'firstName lastName email _id' },
      })
      // Populate the REFERRING branch so display context reflects where records originated
      .populate<{ referringBranchId: any }>({
        path: 'referringBranchId',
        populate: { path: 'clinicId', select: 'name _id' },
      })
      .lean();

    // Deduplicate by petId — one pet may have multiple referrals to the same vet
    const seen = new Set<string>();
    const pets: any[] = [];

    for (const ref of referrals) {
      const pet = ref.petId as any;
      if (!pet?._id) continue;
      const key = pet._id.toString();
      if (seen.has(key)) continue;
      seen.add(key);

      // Use the referring (originating) branch for display — records were created there
      const originBranch = ref.referringBranchId as any;
      const originClinic = originBranch?.clinicId as any;
      const owner = pet.ownerId as any;

      pets.push({
        _id: pet._id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        photo: pet.photo ?? null,
        sex: pet.sex,
        dateOfBirth: pet.dateOfBirth ?? null,
        color: pet.color ?? null,
        sterilization: pet.sterilization ?? null,
        nfcTagId: pet.nfcTagId ?? null,
        microchipNumber: pet.microchipNumber ?? null,
        allergies: pet.allergies ?? [],
        ownerId: owner?._id ?? '',
        ownerFirstName: owner?.firstName ?? '',
        ownerLastName: owner?.lastName ?? '',
        ownerEmail: owner?.email ?? '',
        // Display the originating clinic/branch so the pet does not appear to "belong" to
        // the referred vet's branch — record ownership is not moved by referral.
        clinicId: originClinic?._id ?? '',
        clinicName: originClinic?.name ?? '',
        clinicBranchId: originBranch?._id ?? '',
        clinicBranchName: originBranch?.name ?? '',
      });
    }

    return res.status(200).json({ status: 'SUCCESS', data: { pets } });
  } catch (error) {
    console.error('Get referred pets error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching referred pets' });
  }
};
