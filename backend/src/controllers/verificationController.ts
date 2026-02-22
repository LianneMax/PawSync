import { Request, Response } from 'express';
import VetVerification from '../models/VetVerification';
import VetApplication from '../models/VetApplication';
import AssignedVet from '../models/AssignedVet';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import User from '../models/User';

/**
 * Submit a PRC verification request (vet submits during onboarding)
 */
export const submitVerification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      firstName,
      lastName,
      middleName,
      suffix,
      prcLicenseNumber,
      profession,
      registrationDate,
      expirationDate,
      prcIdPhoto,
      clinicId,
      branchId
    } = req.body;

    if (!firstName || !lastName || !prcLicenseNumber || !registrationDate || !expirationDate) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide all required PRC fields'
      });
    }

    // Check if vet already has a pending or verified submission for this clinic
    const existing = await VetVerification.findOne({
      vetId: req.user.userId,
      clinicId: clinicId || null,
      status: { $in: ['pending', 'verified'] }
    });

    if (existing) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'You already have a pending or verified submission for this clinic'
      });
    }

    const verification = await VetVerification.create({
      vetId: req.user.userId,
      firstName,
      lastName,
      middleName: middleName || null,
      suffix: suffix || null,
      prcLicenseNumber,
      profession: profession || 'Veterinarian',
      registrationDate,
      expirationDate,
      prcIdPhoto: prcIdPhoto || null,
      clinicId: clinicId || null,
      branchId: branchId || null
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Verification request submitted successfully',
      data: { verification }
    });
  } catch (error) {
    console.error('Submit verification error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while submitting verification' });
  }
};

/**
 * Get verification requests for a clinic or branch (clinic admin or branch admin)
 */
export const getClinicVerifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status } = req.query;
    const filter: any = {};
    
    if (req.user.userType === 'clinic-admin') {
      const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });
      if (!clinic) {
        return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
      }
      filter.clinicId = clinic._id;
    } else if (req.user.userType === 'branch-admin') {
      // Branch admin only sees verifications for their branch
      filter.branchId = req.user.branchId;
    } else {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized' });
    }

    if (status && ['pending', 'verified', 'rejected'].includes(status as string)) {
      filter.status = status;
    }

    const verifications = await VetVerification.find(filter)
      .populate('vetId', 'firstName lastName email')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { verifications }
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching verifications' });
  }
};

/**
 * Approve (verify) a PRC verification request (clinic admin or branch admin)
 */
export const approveVerification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Build verification query based on user type
    let query: any = {
      _id: req.params.verificationId,
      clinicId: clinic._id,
      status: 'pending'
    };

    // Branch admin can only verify verifications for their branch
    if (req.user.userType === 'branch-admin') {
      query.branchId = req.user.branchId;
    }

    const verification = await VetVerification.findOne(query);

    if (!verification) {
      return res.status(404).json({ status: 'ERROR', message: 'Verification request not found' });
    }

    verification.status = 'verified';
    verification.reviewedBy = req.user.userId as any;
    verification.reviewedAt = new Date();
    await verification.save();

    // Also mark the vet user as verified
    await User.findByIdAndUpdate(verification.vetId, { isVerified: true });

    // Auto-approve the vet's pending application for this clinic and create AssignedVet
    const pendingApplication = await VetApplication.findOne({
      vetId: verification.vetId,
      clinicId: clinic._id,
      status: 'pending'
    });

    if (pendingApplication) {
      pendingApplication.status = 'approved';
      pendingApplication.reviewedBy = req.user.userId as any;
      pendingApplication.reviewedAt = new Date();
      pendingApplication.verificationId = verification._id as any;
      await pendingApplication.save();

      // Create AssignedVet record for the branch
      const branch = await ClinicBranch.findById(pendingApplication.branchId);
      const existingAssignment = await AssignedVet.findOne({
        vetId: verification.vetId,
        clinicBranchId: pendingApplication.branchId,
        petId: null
      });

      if (!existingAssignment) {
        await AssignedVet.create({
          vetId: verification.vetId,
          clinicId: clinic._id,
          clinicBranchId: pendingApplication.branchId,
          clinicName: clinic.name,
          clinicAddress: branch?.address || null,
          assignedAt: new Date()
        });
      }
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Verification approved successfully',
      data: { verification }
    });
  } catch (error) {
    console.error('Approve verification error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while approving verification' });
  }
};

/**
 * Reject a PRC verification request (clinic admin or branch admin)
 */
export const rejectVerification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { reason } = req.body;
    const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Build verification query based on user type
    let query: any = {
      _id: req.params.verificationId,
      clinicId: clinic._id,
      status: 'pending'
    };

    // Branch admin can only reject verifications for their branch
    if (req.user.userType === 'branch-admin') {
      query.branchId = req.user.branchId;
    }

    const verification = await VetVerification.findOne(query);

    if (!verification) {
      return res.status(404).json({ status: 'ERROR', message: 'Verification request not found' });
    }

    verification.status = 'rejected';
    verification.rejectionReason = reason || null;
    verification.reviewedBy = req.user.userId as any;
    verification.reviewedAt = new Date();
    await verification.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Verification rejected',
      data: { verification }
    });
  } catch (error) {
    console.error('Reject verification error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while rejecting verification' });
  }
};

/**
 * Get my verification status (vet user)
 */
export const getMyVerification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const verifications = await VetVerification.find({ vetId: req.user.userId })
      .populate('clinicId', 'name')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { verifications }
    });
  } catch (error) {
    console.error('Get my verification error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching verification status' });
  }
};
