import { Request, Response } from 'express';
import VetApplication from '../models/VetApplication';
import VetVerification from '../models/VetVerification';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';

/**
 * Submit a vet application to a clinic (vet during onboarding)
 */
export const applyToClinic = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { clinicId, branchId, verificationId } = req.body;

    if (!clinicId || !branchId) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Clinic and branch are required'
      });
    }

    // Verify clinic and branch exist
    const clinic = await Clinic.findOne({ _id: clinicId, isActive: true });
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId, isActive: true });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Check for existing application
    const existing = await VetApplication.findOne({
      vetId: req.user.userId,
      clinicId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'You already have a pending or approved application for this clinic'
      });
    }

    const application = await VetApplication.create({
      vetId: req.user.userId,
      clinicId,
      branchId,
      verificationId: verificationId || null
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Application submitted successfully',
      data: { application }
    });
  } catch (error: any) {
    console.error('Apply to clinic error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ status: 'ERROR', message: 'You already have an application for this clinic' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while submitting application' });
  }
};

/**
 * Get applications for a clinic (clinic admin)
 */
export const getClinicApplications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status } = req.query;
    // Use clinicId from JWT if available, otherwise fallback to adminId lookup
    let clinic;
    if (req.user.clinicId) {
      clinic = await Clinic.findOne({ _id: req.user.clinicId, isActive: true });
    } else {
      clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });
    }

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const filter: any = { clinicId: clinic._id };
    if (req.user.clinicBranchId) {
      filter.branchId = req.user.clinicBranchId;
    }
    if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
      filter.status = status;
    }

    const applications = await VetApplication.find(filter)
      .populate('vetId', 'firstName lastName email')
      .populate('branchId', 'name')
      .populate('verificationId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { applications }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching applications' });
  }
};

/**
 * Approve a vet application (clinic admin)
 */
export const approveApplication = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = req.user.clinicId
      ? await Clinic.findOne({ _id: req.user.clinicId, isActive: true })
      : await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const application = await VetApplication.findOne({
      _id: req.params.applicationId,
      clinicId: clinic._id,
      status: 'pending'
    });

    if (!application) {
      return res.status(404).json({ status: 'ERROR', message: 'Application not found' });
    }

    application.status = 'approved';
    application.reviewedBy = req.user.userId as any;
    application.reviewedAt = new Date();
    await application.save();

    // Auto-assign the vet to the branch
    const branch = await ClinicBranch.findById(application.branchId);
    await AssignedVet.create({
      vetId: application.vetId,
      clinicId: clinic._id,
      clinicBranchId: application.branchId,
      clinicName: clinic.name,
      clinicAddress: branch?.address || null,
      assignedAt: new Date()
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Application approved and vet assigned to branch',
      data: { application }
    });
  } catch (error) {
    console.error('Approve application error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while approving application' });
  }
};

/**
 * Reject a vet application (clinic admin)
 */
export const rejectApplication = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { reason } = req.body;
    const clinic = req.user.clinicId
      ? await Clinic.findOne({ _id: req.user.clinicId, isActive: true })
      : await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const application = await VetApplication.findOne({
      _id: req.params.applicationId,
      clinicId: clinic._id,
      status: 'pending'
    });

    if (!application) {
      return res.status(404).json({ status: 'ERROR', message: 'Application not found' });
    }

    application.status = 'rejected';
    application.rejectionReason = reason || null;
    application.reviewedBy = req.user.userId as any;
    application.reviewedAt = new Date();
    await application.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Application rejected',
      data: { application }
    });
  } catch (error) {
    console.error('Reject application error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while rejecting application' });
  }
};

/**
 * Get my applications (vet user)
 */
export const getMyApplications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const applications = await VetApplication.find({ vetId: req.user.userId })
      .populate('clinicId', 'name')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { applications }
    });
  } catch (error) {
    console.error('Get my applications error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching applications' });
  }
};
