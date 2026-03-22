import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import VetApplication from '../models/VetApplication';
import VetInvitation from '../models/VetInvitation';
import User from '../models/User';
import MedicalRecord from '../models/MedicalRecord';
import Vaccination from '../models/Vaccination';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';
import { updateBranchStatus } from '../services/branchStatusService';
import {
  sendVetInvitation,
  sendVetBranchAssigned,
  sendVetBranchReassigned,
  sendBranchOTP,
  sendNewBranchNotification,
  sendClinicClosureCancellation,
  sendClinicClosureRescheduled,
} from '../services/emailService';
import VetLeave from '../models/VetLeave';

// ─── In-memory OTP store (email → { otp, expiresAt }) ────────────────────────
const branchOtpStore = new Map<string, { otp: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of branchOtpStore.entries()) {
    if (val.expiresAt < now) branchOtpStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Helper: get clinic for the authenticated admin using clinicId from JWT.
 * Multiple fallbacks handle stale JWTs that may be missing clinicId/branchId.
 */
export async function getClinicForAdmin(req: Request): Promise<any> {
  if (req.user?.clinicId) {
    return Clinic.findOne({ _id: req.user.clinicId, isActive: true });
  }
  // clinicBranchId in JWT: derive clinic from the branch document
  if (req.user?.clinicBranchId) {
    const branch = await ClinicBranch.findById(req.user.clinicBranchId).select('clinicId');
    if (branch?.clinicId) {
      return Clinic.findOne({ _id: branch.clinicId, isActive: true });
    }
  }
  // Stale-JWT fallback: look up clinicId/clinicBranchId from the User document
  if (req.user?.userId && req.user?.userType === 'clinic-admin') {
    const dbUser = await User.findById(req.user.userId).select('clinicId clinicBranchId');
    if (dbUser?.clinicId) {
      return Clinic.findOne({ _id: dbUser.clinicId, isActive: true });
    }
    if (dbUser?.clinicBranchId) {
      const branch = await ClinicBranch.findById(dbUser.clinicBranchId).select('clinicId');
      if (branch?.clinicId) {
        return Clinic.findOne({ _id: branch.clinicId, isActive: true });
      }
    }
  }
  return null;
}

/**
 * GET /api/clinics/mine/branches
 * Returns all active branches for the authenticated admin's clinic.
 * Resolves the clinicId directly from the JWT or the admin's User/Branch document —
 * no Clinic document lookup required, so it works even if Clinic.isActive is false.
 */
export const getMyBranches = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    // Always derive clinicId from the branch document (JWT's clinicId can be stale).
    // Priority: clinicBranchId from JWT → clinicBranchId from DB User → clinicId from JWT
    let clinicId: any = null;

    const branchIdStr = req.user.clinicBranchId;
    if (branchIdStr) {
      const branch = await ClinicBranch.findById(branchIdStr).select('clinicId');
      clinicId = branch?.clinicId ?? null;
    }

    if (!clinicId && req.user.userId) {
      const dbUser = await User.findById(req.user.userId).select('clinicId clinicBranchId');
      if (dbUser?.clinicBranchId) {
        const branch = await ClinicBranch.findById(dbUser.clinicBranchId).select('clinicId');
        clinicId = branch?.clinicId ?? null;
      }
      if (!clinicId && dbUser?.clinicId) {
        clinicId = dbUser.clinicId;
      }
    }

    // Last resort: use JWT clinicId directly
    if (!clinicId && req.user.clinicId) {
      clinicId = req.user.clinicId;
    }

    if (!clinicId) {
      return res.status(404).json({ status: 'ERROR', message: 'Could not resolve clinic for this account' });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());
    const branches = await ClinicBranch.find({ clinicId: clinicObjectId })
      .sort({ isMain: -1, createdAt: -1 });

    console.log('[getMyBranches] jwt.clinicBranchId:', req.user.clinicBranchId, '| resolved clinicId:', clinicObjectId.toString(), '| branches found:', branches.length);

    return res.status(200).json({ status: 'SUCCESS', data: { branches } });
  } catch (error) {
    console.error('Get my branches error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching branches' });
  }
};

/**
 * Helper: resolve the branchId for a clinic-admin, even if missing from JWT.
 */
async function getBranchIdForAdmin(req: Request): Promise<string | undefined> {
  if (req.user?.clinicBranchId) return req.user.clinicBranchId;
  // Stale-JWT: look up from User document
  if (req.user?.userId && req.user?.userType === 'clinic-admin') {
    const dbUser = await User.findById(req.user.userId).select('clinicBranchId');
    if (dbUser?.clinicBranchId) return dbUser.clinicBranchId.toString();
  }
  return undefined;
}

// ==================== CLINIC ====================

/**
 * Get clinics managed by the authenticated admin
 */
export const getMyClinics = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(200).json({ status: 'SUCCESS', data: { clinics: [] } });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { clinics: [clinic] }
    });
  } catch (error) {
    console.error('Get clinics error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching clinics' });
  }
};

/**
 * Get all active clinics with their branches (public - for vet/user onboarding)
 */
export const getAllClinics = async (req: Request, res: Response) => {
  try {
    const clinics = await Clinic.find({ isActive: true })
      .select('name address mainBranchId')
      .sort({ name: 1 });

    const clinicsWithBranches = await Promise.all(
      clinics.map(async (clinic) => {
        const branchFilter: any = { clinicId: clinic._id };
        if (req.query.allBranches !== 'true') {
          branchFilter.isActive = true;
        }
        const branches = await ClinicBranch.find(branchFilter)
          .select('name address isMain')
          .sort({ isMain: -1, name: 1 });

        return {
          _id: clinic._id,
          name: clinic.name,
          address: clinic.address,
          mainBranchId: clinic.mainBranchId || null,
          branches
        };
      })
    );

    return res.status(200).json({
      status: 'SUCCESS',
      data: { clinics: clinicsWithBranches }
    });
  } catch (error) {
    console.error('Get all clinics error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching clinics' });
  }
};

// ==================== BRANCHES ====================

/**
 * Get all branches for a clinic
 */
export const getBranches = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Non-main branch admins only see their own branch
    const branchQuery: any = { clinicId: clinic._id };
    
    // Only filter by isActive if includeInactive is not true
    const includeInactive = req.query.includeInactive === 'true';
    if (!includeInactive) {
      branchQuery.isActive = true;
    }
    
    if (req.user.clinicBranchId && !req.user.isMainBranch) {
      branchQuery._id = req.user.clinicBranchId;
    }

    const branches = await ClinicBranch.find(branchQuery)
      .sort({ isMain: -1, createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { branches }
    });
  } catch (error) {
    console.error('Get branches error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching branches' });
  }
};

/**
 * Add a branch to a clinic
 */
export const addBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { name, address, city, province, phone, email, openingTime, closingTime, operatingDays, isMain, adminPassword } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Branch name is required' });
    }

    // Prevent duplicate branch names within the same clinic (escape regex special chars)
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await ClinicBranch.findOne({
      clinicId: clinic._id,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });
    if (duplicate) {
      return res.status(409).json({ status: 'ERROR', message: 'A branch with this name already exists' });
    }

    // If this branch is set as main, unset the current main branch
    if (isMain) {
      await ClinicBranch.updateMany(
        { clinicId: clinic._id, isMain: true },
        { isMain: false }
      );
    }

    const branch = await ClinicBranch.create({
      clinicId: clinic._id,
      name,
      address,
      city: city || null,
      province: province || null,
      phone: phone || null,
      email: email || null,
      openingTime: openingTime || null,
      closingTime: closingTime || null,
      operatingDays: operatingDays || [],
      isMain: isMain || false
    });

    // Create the branch admin user (required — roll back branch if this fails)
    const adminEmail = (email || '').trim().toLowerCase();
    const adminPass = (adminPassword || '').toString();

    if (!adminEmail || !adminPass) {
      await branch.deleteOne();
      return res.status(400).json({ status: 'ERROR', message: 'Branch email and password are required to create a branch admin account' });
    }

    try {
      // If there's an orphaned inactive account with this email, reactivate it
      const orphaned = await User.findOne({ email: adminEmail, userType: 'inactive' });
      if (orphaned) {
        orphaned.password = adminPass;
        orphaned.userType = 'clinic-admin';
        orphaned.clinicId = clinic._id as any;
        orphaned.clinicBranchId = branch._id as any;
        orphaned.isMainBranch = false;
        orphaned.isVerified = true;
        await orphaned.save();
      } else {
        await User.create({
          email: adminEmail,
          password: adminPass,
          firstName: 'Branch',
          lastName: 'Admin',
          userType: 'clinic-admin',
          clinicId: clinic._id,
          clinicBranchId: branch._id,
          isMainBranch: false,
          isVerified: true,
        });
      }
    } catch (adminErr: any) {
      console.error('[addBranch] Failed to create branch admin:', adminErr);
      // Roll back the branch so we don't leave an orphaned branch without an admin
      await branch.deleteOne();
      if (adminErr.code === 11000) {
        return res.status(409).json({ status: 'ERROR', message: 'Email is already registered to another account' });
      }
      if (adminErr.name === 'ValidationError') {
        const messages = Object.values(adminErr.errors).map((e: any) => e.message);
        return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
      }
      return res.status(500).json({ status: 'ERROR', message: `Failed to create branch admin: ${adminErr.message}` });
    }

    // Update clinic's mainBranchId if this is the new main
    if (isMain) {
      await Clinic.findByIdAndUpdate(clinic._id, { mainBranchId: branch._id });
    }

    // New branches start inactive until a vet is assigned
    await updateBranchStatus(branch._id.toString());

    // Notify the main branch about the newly added branch
    try {
      const mainBranch = await ClinicBranch.findOne({ clinicId: clinic._id, isMain: true }).select('name email');
      if (mainBranch?.email) {
        await sendNewBranchNotification({
          mainBranchEmail: mainBranch.email,
          mainBranchName: mainBranch.name,
          newBranchName: branch.name,
          newBranchAddress: `${branch.address}${branch.city ? ', ' + branch.city : ''}${branch.province ? ', ' + branch.province : ''}`,
          clinicName: clinic.name,
        });
      }
    } catch (emailErr) {
      console.error('[addBranch] Failed to send main branch notification:', emailErr);
    }

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Branch added successfully',
      data: { branch }
    });
  } catch (error: any) {
    console.error('Add branch error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while adding the branch' });
  }
};

/**
 * Update a branch
 */
export const updateBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: req.params.branchId, clinicId: clinic._id });

    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    const { name, address, city, province, phone, email, openingTime, closingTime, operatingDays, isMain, isActive } = req.body;

    // If setting as main, unset the current main branch first
    if (isMain && !branch.isMain) {
      await ClinicBranch.updateMany(
        { clinicId: clinic._id, isMain: true },
        { isMain: false }
      );
    }

    const allowedFields: Record<string, any> = { name, address, city, province, phone, email, openingTime, closingTime, operatingDays, isMain, isActive };
    for (const [key, value] of Object.entries(allowedFields)) {
      if (value !== undefined) {
        (branch as any)[key] = value;
      }
    }

    await branch.save();

    // Update clinic's mainBranchId if this branch is now the main
    if (isMain) {
      await Clinic.findByIdAndUpdate(clinic._id, { mainBranchId: branch._id });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Branch updated successfully',
      data: { branch }
    });
  } catch (error: any) {
    console.error('Update branch error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the branch' });
  }
};

/**
 * Delete a branch
 */
export const deleteBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: req.params.branchId, clinicId: clinic._id });

    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    if (branch.isMain) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot delete the main branch' });
    }

    const { transferToBranchId, reassignVetsToBranchId } = req.body;

    // ── Vet reassignment ────────────────────────────────────────────────────────
    const branchVetCount = await User.countDocuments({ clinicBranchId: branch._id, isActive: true });
    if (branchVetCount > 0) {
      if (!reassignVetsToBranchId) {
        return res.status(400).json({ status: 'ERROR', message: 'Must select a branch to reassign vets to' });
      }
      const targetVetBranch = await ClinicBranch.findOne({ _id: reassignVetsToBranchId, clinicId: clinic._id });
      if (!targetVetBranch) {
        return res.status(400).json({ status: 'ERROR', message: 'Target branch for vet reassignment not found' });
      }
      await User.updateMany({ clinicBranchId: branch._id }, { $set: { clinicBranchId: reassignVetsToBranchId } });
      await VetApplication.updateMany({ branchId: branch._id, clinicId: clinic._id }, { $set: { branchId: reassignVetsToBranchId } });
    }

    // ── Record transfer ─────────────────────────────────────────────────────────
    const hasRecords = await MedicalRecord.exists({ clinicBranchId: branch._id });
    const hasVaccinations = await Vaccination.exists({ clinicBranchId: branch._id });
    if (hasRecords || hasVaccinations) {
      if (!transferToBranchId) {
        return res.status(400).json({ status: 'ERROR', message: 'Must select a branch to transfer records to' });
      }
      const targetRecordBranch = await ClinicBranch.findOne({ _id: transferToBranchId, clinicId: clinic._id });
      if (!targetRecordBranch) {
        return res.status(400).json({ status: 'ERROR', message: 'Target branch for record transfer not found' });
      }
      await MedicalRecord.updateMany({ clinicBranchId: branch._id }, { $set: { clinicBranchId: transferToBranchId } });
      await Vaccination.updateMany({ clinicBranchId: branch._id }, { $set: { clinicBranchId: transferToBranchId } });
    }

    // Deactivate clinic-admin accounts tied to this branch so their emails can be reused
    await User.updateMany(
      { clinicBranchId: branch._id, userType: 'clinic-admin', isMainBranch: false },
      { $set: { userType: 'inactive', clinicBranchId: null } }
    );

    await branch.deleteOne();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting the branch' });
  }
};

// ==================== BRANCH ADMIN ====================

/**
 * Create a new branch admin account for the same clinic
 */
export const createClinicAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { email, password, firstName: rawFirstName, lastName: rawLastName, branchId } = req.body;

    if (!email || !password || !branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide email, password, and branchId' });
    }

    // firstName/lastName are optional; default to 'Branch' / 'Admin' if not supplied
    const firstName = rawFirstName?.trim() || 'Branch';
    const lastName = rawLastName?.trim() || 'Admin';

    // Verify the branch belongs to this clinic
    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ status: 'ERROR', message: 'Email is already registered' });
    }

    // Create the branch admin user
    // Set isMainBranch based on whether this branch is the main branch
    const newAdmin = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      userType: 'clinic-admin',
      clinicId: clinic._id,
      clinicBranchId: branchId,
      isMainBranch: branch.isMain,
      isVerified: true
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Branch admin created successfully',
      data: {
        admin: {
          id: newAdmin._id,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName,
          email: newAdmin.email,
          branchId: branchId,
          branchName: branch.name
        }
      }
    });
  } catch (error: any) {
    console.error('Create branch admin error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      const value = error.keyValue?.[field];
      if (field === 'email' || field === 'email_1') {
        return res.status(409).json({ status: 'ERROR', message: 'Email is already registered' });
      }
      return res.status(409).json({ status: 'ERROR', message: `Duplicate value on ${field}: ${value}` });
    }
    return res.status(500).json({ status: 'ERROR', message: `Failed to create admin: ${error.message}` });
  }
};

// ==================== VET ASSIGNMENT ====================

/**
 * Assign a vet to a clinic branch (clinic admin approves vet registration)
 */
export const assignVetToBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { branchId, vetId } = req.body;

    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id });

    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Check if the vet is already assigned to this branch
    const existing = await AssignedVet.findOne({ vetId, clinicBranchId: branchId, isActive: true });

    if (existing) {
      return res.status(400).json({ status: 'ERROR', message: 'Vet is already assigned to this branch' });
    }

    // Check if vet is currently assigned to a different branch (re-assignment)
    const previousAssignment = await AssignedVet.findOne({
      vetId,
      clinicBranchId: { $ne: branchId },
      isActive: true,
    }).populate<{ clinicBranchId: { _id: any; name: string } }>('clinicBranchId', 'name');

    const assignment = await AssignedVet.create({
      vetId,
      clinicId: clinic._id,
      clinicBranchId: branchId,
      clinicName: clinic.name,
      clinicAddress: branch.address,
      assignedAt: new Date()
    });

    // Update the branch status (mark as active if it has vets)
    await updateBranchStatus(branchId);

    // Send email notification to the vet
    const vet = await User.findById(vetId).select('email firstName lastName');
    if (vet?.email) {
      if (previousAssignment) {
        const oldBranchName = (previousAssignment.clinicBranchId as any)?.name ?? 'Previous Branch';
        sendVetBranchReassigned({
          vetEmail: vet.email,
          vetFirstName: vet.firstName,
          vetLastName: vet.lastName,
          oldBranchName,
          newBranchName: branch.name,
          clinicName: clinic.name,
          newBranchAddress: branch.address ?? '',
        }).catch(() => {});
      } else {
        sendVetBranchAssigned({
          vetEmail: vet.email,
          vetFirstName: vet.firstName,
          vetLastName: vet.lastName,
          branchName: branch.name,
          clinicName: clinic.name,
          branchAddress: branch.address ?? '',
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Vet assigned to branch successfully',
      data: { assignment }
    });
  } catch (error) {
    console.error('Assign vet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while assigning the vet' });
  }
};

/**
 * Remove a vet from a clinic branch
 */
export const removeVetFromBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const assignment = await AssignedVet.findOne({
      _id: req.params.assignmentId,
      clinicId: clinic._id,
      isActive: true
    });

    if (!assignment) {
      return res.status(404).json({ status: 'ERROR', message: 'Assignment not found' });
    }

    assignment.isActive = false;
    await assignment.save();

    // Update the branch status (mark as inactive if it has no vets)
    await updateBranchStatus(assignment.clinicBranchId?.toString() || '');

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Vet removed from branch successfully'
    });
  } catch (error) {
    console.error('Remove vet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while removing the vet' });
  }
};

// ==================== DASHBOARD ====================

/**
 * Get dashboard stats for the clinic admin (filtered by branch)
 */
export const getClinicDashboardStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branchId = (!req.user.isMainBranch)
      ? await getBranchIdForAdmin(req)
      : undefined;

    const vetAppFilter: any = { clinicId: clinic._id };
    if (branchId) vetAppFilter.branchId = branchId;

    const assignmentFilter: any = { clinicId: clinic._id, isActive: true, petId: null };
    if (branchId) assignmentFilter.clinicBranchId = branchId;

    const [branchCount, activeAssignments, pendingApplicationCount] = await Promise.all([
      branchId
        ? ClinicBranch.countDocuments({ _id: branchId, clinicId: clinic._id, isActive: true })
        : ClinicBranch.countDocuments({ clinicId: clinic._id, isActive: true }),
      AssignedVet.find(assignmentFilter).select('vetId').lean(),
      VetApplication.countDocuments({ ...vetAppFilter, status: 'pending' }),
    ]);

    const uniqueVetIds = new Set(
      activeAssignments
        .map((assignment: any) => assignment?.vetId?.toString())
        .filter(Boolean)
    );

    // Get branch name if branch-specific
    let branchName = null;
    if (branchId) {
      const branch = await ClinicBranch.findById(branchId).select('name');
      branchName = branch?.name || null;
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        clinic: {
          _id: clinic._id,
          name: clinic.name,
        },
        branch: branchId ? { _id: branchId, name: branchName } : null,
        stats: {
          totalVeterinarians: uniqueVetIds.size,
          activeBranches: branchCount,
          pendingApplications: pendingApplicationCount,
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching dashboard stats' });
  }
};

/**
 * Get active vets for a clinic (filtered by branch).
 * Uses AssignedVet as the source of truth so vets added via direct assignment
 * (assignVetToBranch) are included alongside those added via VetApplication.
 */
export const getClinicVets = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Query active clinic-level assignments (petId: null = clinic assignment, not pet assignment)
    const assignmentFilter: any = { clinicId: clinic._id, isActive: true, petId: null };
    const branchId = (!req.user.isMainBranch)
      ? await getBranchIdForAdmin(req)
      : undefined;
    if (branchId) {
      assignmentFilter.clinicBranchId = branchId;
    }

    const activeAssignments = await AssignedVet.find(assignmentFilter)
      .populate('vetId', 'firstName lastName email userType resignation')
      .populate('clinicBranchId', 'name')
      .sort({ assignedAt: -1 });

    // Enrich with prcLicenseNumber from VetApplication where available
    const vetIds = activeAssignments.map((a) => (a.vetId as any)?._id).filter(Boolean);
    const approvedApplications = await VetApplication.find({
      clinicId: clinic._id,
      vetId: { $in: vetIds },
      status: 'approved',
    }).populate('verificationId', 'prcLicenseNumber');

    const appByVetId = new Map(
      approvedApplications.map((app) => [app.vetId.toString(), app])
    );

    // Check which vets are on approved leave today (show On Leave only on the actual day)
    const todayUTCStart = new Date();
    todayUTCStart.setUTCHours(0, 0, 0, 0);
    const todayUTCEnd = new Date();
    todayUTCEnd.setUTCHours(23, 59, 59, 999);

    const todayLeaves = await VetLeave.find({
      vetId: { $in: vetIds },
      date: { $gte: todayUTCStart, $lte: todayUTCEnd },
      status: 'active',
    }).select('vetId');

    const onLeaveVetIds = new Set(todayLeaves.map((l) => l.vetId.toString()));

    const vets = activeAssignments
      .filter((a) => a.vetId)
      .map((a) => {
        const vet = a.vetId as any;
        const branch = a.clinicBranchId as any;
        const app = appByVetId.get(vet._id.toString());
        const verification = (app?.verificationId) as any;
        const isResigned = vet.userType === 'inactive' || vet?.resignation?.status === 'completed';
        const isOnLeave = onLeaveVetIds.has(vet._id.toString());

        return {
          _id: app?._id || a._id,
          vetId: vet._id,
          clinicBranchId: branch?._id || a.clinicBranchId || null,
          name: `Dr. ${vet.firstName} ${vet.lastName}`,
          email: vet.email || '',
          initials: `${vet.firstName?.[0] || ''}${vet.lastName?.[0] || ''}`,
          branch: branch?.name || a.clinicName || 'Unassigned',
          prcLicense: verification?.prcLicenseNumber || '-',
          status: isResigned ? 'Resigned' : (isOnLeave ? 'On Leave' : 'Active'),
        };
      });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vets }
    });
  } catch (error) {
    console.error('Get clinic vets error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vets' });
  }
};

/**
 * Get all patients (pets) for a clinic or branch, derived from appointments.
 * Accessible by: clinic-admin, clinic-admin.
 * Branch-admins see only patients who have had appointments at their branch.
 */
export const getClinicPatients = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    if (req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Only clinic or branch admins can access this' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // clinic-admin: filter by their branch; clinic-admin: optionally filter by clinicBranchId
    // getBranchIdForAdmin handles stale JWTs by falling back to the User document
    const branchId = req.user.userType === 'clinic-admin'
      ? await getBranchIdForAdmin(req)
      : req.user.clinicBranchId;

    // Build appointment filter — source of truth for which patients visited this branch
    const apptFilter: any = { clinicId: clinic._id };
    if (branchId) {
      apptFilter.clinicBranchId = branchId;
    }

    // Fetch all appointments for this clinic/branch, sorted newest first
    const appointments = await Appointment.find(apptFilter)
      .populate('petId')
      .sort({ date: -1, createdAt: -1 });

    // Extract unique pets and track their latest appointment date
    const petMap = new Map<string, any>();
    const lastVisitMap = new Map<string, string>();

    for (const appt of appointments) {
      const pet = appt.petId as any;
      if (!pet) continue;
      const petId = pet._id.toString();
      if (!petMap.has(petId)) {
        petMap.set(petId, pet);
      }
      if (!lastVisitMap.has(petId)) {
        lastVisitMap.set(petId, String(appt.date));
      }
    }

    // Count medical records per pet (scoped to same clinic/branch)
    const recordFilter: any = { clinicId: clinic._id };
    if (branchId) recordFilter.clinicBranchId = branchId;
    const medicalRecords = await MedicalRecord.find(recordFilter).select('petId');
    const recordCountMap = new Map<string, number>();
    for (const rec of medicalRecords) {
      const petId = rec.petId.toString();
      recordCountMap.set(petId, (recordCountMap.get(petId) || 0) + 1);
    }

    // Populate owner details for each unique pet
    const pets = Array.from(petMap.values());
    const petsWithOwners = await Promise.all(
      pets.map(async (pet: any) => {
        const owner = await User.findById(pet.ownerId).select('firstName lastName contactNumber email');
        return {
          _id: pet._id,
          name: pet.name,
          status: pet.status,
          isAlive: pet.isAlive,
          isLost: pet.isLost,
          isConfined: pet.isConfined,
          removedByOwner: pet.removedByOwner,
          species: pet.species,
          breed: pet.breed,
          sex: pet.sex,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          photo: pet.photo,
          microchipNumber: pet.microchipNumber,
          bloodType: pet.bloodType,
          owner: {
            _id: owner?._id,
            firstName: owner?.firstName,
            lastName: owner?.lastName,
            contactNumber: owner?.contactNumber,
            email: owner?.email
          },
          recordCount: recordCountMap.get(pet._id.toString()) || 0,
          lastVisit: lastVisitMap.get(pet._id.toString()) || null
        };
      })
    );

    return res.status(200).json({
      status: 'SUCCESS',
      data: { patients: petsWithOwners }
    });
  } catch (error) {
    console.error('Get clinic patients error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching clinic patients' });
  }
};

// ==================== VET INVITATIONS ====================

/**
 * Get all registered (verified) veterinarians for the invite modal.
 * Returns basic info + their current branch assignment.
 */
export const getRegisteredVets = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vets = await User.find({ userType: 'veterinarian', isVerified: true })
      .select('firstName lastName email clinicBranchId clinicId')
      .populate('clinicBranchId', 'name')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const result = vets.map((v: any) => ({
      _id: v._id,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      currentBranch: v.clinicBranchId ? (v.clinicBranchId as any).name : null,
    }));

    return res.status(200).json({ status: 'SUCCESS', data: { vets: result } });
  } catch (error) {
    console.error('Get registered vets error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vets' });
  }
};

/**
 * Send an invitation email to a registered vet to join the inviting branch.
 * Creates a VetInvitation record with a secure token (7-day expiry).
 */
export const inviteVet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { vetId, branchId } = req.body;
    if (!vetId || !branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'vetId and branchId are required' });
    }

    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    const vet = await User.findOne({ _id: vetId, userType: 'veterinarian', isVerified: true });
    if (!vet) {
      return res.status(404).json({ status: 'ERROR', message: 'Veterinarian not found' });
    }

    // Cancel ALL existing pending invitations for this vet (any branch) before creating a new one
    await VetInvitation.deleteMany({ vetId, status: 'pending' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await VetInvitation.create({ vetId, clinicId: clinic._id, branchId, token, expiresAt });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptUrl = `${FRONTEND_URL}/invite/accept?token=${token}`;

    await sendVetInvitation({
      vetEmail: vet.email,
      vetFirstName: vet.firstName,
      vetLastName: vet.lastName,
      branchName: branch.name,
      clinicName: clinic.name,
      acceptUrl,
    });

    return res.status(200).json({ status: 'SUCCESS', message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite vet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while sending the invitation' });
  }
};

/**
 * Accept a vet invitation via token (public endpoint — no auth required).
 * Assigns the vet to the inviting branch and marks invitation as accepted.
 */
export const acceptVetInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) {
      return res.status(400).json({ status: 'ERROR', message: 'Invitation token is required' });
    }

    const invitation = await VetInvitation.findOne({ token })
      .populate('branchId', 'name address')
      .populate('clinicId', 'name');

    if (!invitation) {
      return res.status(404).json({ status: 'ERROR', message: 'Invitation not found or already used' });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({ status: 'ERROR', message: 'This invitation has already been accepted' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ status: 'ERROR', message: 'This invitation has expired' });
    }

    const branch = invitation.branchId as any;
    const clinic = invitation.clinicId as any;

    // Deactivate all existing clinic-level AssignedVet records for this vet
    await AssignedVet.updateMany(
      { vetId: invitation.vetId, petId: null, isActive: true },
      { isActive: false }
    );

    // Track old branch IDs so we can update their status
    const oldAssignments = await AssignedVet.find({ vetId: invitation.vetId, petId: null }).select('clinicBranchId');
    const oldBranchIds = [...new Set(oldAssignments.map((a: any) => a.clinicBranchId?.toString()).filter(Boolean))];

    // Upsert AssignedVet for the inviting branch (reactivates if a previous record exists)
    await AssignedVet.findOneAndUpdate(
      { vetId: invitation.vetId, clinicBranchId: invitation.branchId },
      {
        $set: {
          clinicId: invitation.clinicId,
          clinicName: clinic.name,
          clinicAddress: branch.address,
          assignedAt: new Date(),
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    // Update the vet's User record to reflect new branch
    await User.findByIdAndUpdate(invitation.vetId, {
      clinicId: invitation.clinicId,
      clinicBranchId: invitation.branchId,
    });

    // Mark invitation as accepted
    invitation.status = 'accepted';
    await invitation.save();

    // Update branch statuses
    await updateBranchStatus(invitation.branchId.toString());
    for (const oldBranchId of oldBranchIds) {
      if (oldBranchId !== invitation.branchId.toString()) {
        await updateBranchStatus(oldBranchId);
      }
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Vet successfully joined the branch',
      data: {
        branchName: branch.name,
        clinicName: clinic.name,
      },
    });
  } catch (error) {
    console.error('Accept vet invitation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while accepting the invitation' });
  }
};

/**
 * Get a single branch by ID (fresh from DB)
 */
export const getSingleBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: req.params.branchId, clinicId: clinic._id });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    return res.status(200).json({ status: 'SUCCESS', data: { branch } });
  } catch (error) {
    console.error('Get single branch error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the branch' });
  }
};

/**
 * Get statistics for a specific branch (vets, patients, and appointments counts)
 */
export const getBranchStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branchId = req.params.branchId;
    if (!branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'branchId is required' });
    }

    // Verify branch exists and belongs to this clinic
    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id, isActive: true });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Count unique active vets assigned to this branch (source of truth)
    const assignedVets = await AssignedVet.find({
      clinicId: clinic._id,
      clinicBranchId: branchId,
      isActive: true,
      petId: null,
    }).select('vetId').lean();
    const vetCount = new Set(
      assignedVets
        .map((assignment: any) => assignment?.vetId?.toString())
        .filter(Boolean)
    ).size;

    // Count unique patients (pets) who have appointments at this branch
    const appointments = await Appointment.find({
      clinicId: clinic._id,
      clinicBranchId: branchId
    }).distinct('petId');
    const patientCount = appointments.length;

    // Count total appointments for this branch
    const appointmentCount = await Appointment.countDocuments({
      clinicId: clinic._id,
      clinicBranchId: branchId
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        stats: {
          vets: vetCount,
          patients: patientCount,
          appointments: appointmentCount
        }
      }
    });
  } catch (error) {
    console.error('Get branch stats error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching branch stats' });
  }
};

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress'];

type ClosureAction = 'cancel' | 'reschedule';

function parseDateOnlyToUtc(dateStr: string, endOfDay = false): Date {
  return new Date(`${dateStr}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function normalizeDateOnly(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function isBranchClosedOnDateOnly(
  branch: { closureDates?: { startDate: Date; endDate: Date }[] },
  dateOnly: string,
): boolean {
  const dayStart = parseDateOnlyToUtc(dateOnly, false);
  const dayEnd = parseDateOnlyToUtc(dateOnly, true);
  return (branch.closureDates || []).some((closure) => {
    const closureStart = new Date(closure.startDate);
    const closureEnd = new Date(closure.endDate);
    return closureStart <= dayEnd && closureEnd >= dayStart;
  });
}

async function getAffectedAppointmentsForBranchClosure(params: {
  clinicId: mongoose.Types.ObjectId;
  branchId: string;
  startDate: Date;
  endDate: Date;
}) {
  const appointments = await Appointment.find({
    clinicId: params.clinicId,
    clinicBranchId: params.branchId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    date: { $gte: params.startDate, $lte: params.endDate },
  })
    .populate('petId', 'name')
    .populate('ownerId', 'firstName lastName email')
    .populate('vetId', 'firstName lastName')
    .sort({ date: 1, startTime: 1 });

  return appointments;
}

/**
 * POST /api/clinics/:clinicId/branches/:branchId/closure/preview
 * Preview affected appointments for a branch closure date/range.
 */
export const previewBranchClosure = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: req.params.branchId, clinicId: clinic._id, isActive: true });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    const startDateOnly = normalizeDateOnly(req.body?.startDate);
    const endDateOnly = normalizeDateOnly(req.body?.endDate) || startDateOnly;

    if (!startDateOnly || !endDateOnly) {
      return res.status(400).json({ status: 'ERROR', message: 'startDate is required' });
    }

    const startDate = parseDateOnlyToUtc(startDateOnly, false);
    const endDate = parseDateOnlyToUtc(endDateOnly, true);
    if (endDate < startDate) {
      return res.status(400).json({ status: 'ERROR', message: 'End date must be on or after start date' });
    }

    const affectedAppointments = await getAffectedAppointmentsForBranchClosure({
      clinicId: clinic._id,
      branchId: branch._id.toString(),
      startDate,
      endDate,
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        closureType: startDateOnly === endDateOnly ? 'single-day' : 'date-range',
        startDate: startDateOnly,
        endDate: endDateOnly,
        affectedAppointments: affectedAppointments.map((appt: any) => ({
          _id: appt._id,
          petName: appt.petId?.name || 'Unknown Pet',
          ownerName: `${appt.ownerId?.firstName || ''} ${appt.ownerId?.lastName || ''}`.trim(),
          ownerEmail: appt.ownerId?.email || '',
          date: appt.date,
          startTime: appt.startTime,
          status: appt.status,
        })),
      },
    });
  } catch (error) {
    console.error('Preview branch closure error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while previewing branch closure' });
  }
};

/**
 * POST /api/clinics/:clinicId/branches/:branchId/closure/apply
 * Apply a temporary branch closure and optionally cancel/reschedule affected appointments.
 */
export const applyBranchClosure = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branch = await ClinicBranch.findOne({ _id: req.params.branchId, clinicId: clinic._id, isActive: true });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    const startDateOnly = normalizeDateOnly(req.body?.startDate);
    const endDateOnly = normalizeDateOnly(req.body?.endDate) || startDateOnly;
    const action = req.body?.action as ClosureAction | undefined;
    const newDateOnly = normalizeDateOnly(req.body?.newDate);

    if (!startDateOnly || !endDateOnly) {
      return res.status(400).json({ status: 'ERROR', message: 'startDate is required' });
    }

    const startDate = parseDateOnlyToUtc(startDateOnly, false);
    const endDate = parseDateOnlyToUtc(endDateOnly, true);
    if (endDate < startDate) {
      return res.status(400).json({ status: 'ERROR', message: 'End date must be on or after start date' });
    }

    const affectedAppointments = await getAffectedAppointmentsForBranchClosure({
      clinicId: clinic._id,
      branchId: branch._id.toString(),
      startDate,
      endDate,
    });

    if (affectedAppointments.length > 0) {
      if (!action || !['cancel', 'reschedule'].includes(action)) {
        return res.status(400).json({ status: 'ERROR', message: 'Action is required when affected appointments exist' });
      }

      if (action === 'reschedule') {
        if (!newDateOnly) {
          return res.status(400).json({ status: 'ERROR', message: 'newDate is required for rescheduling' });
        }
        const newDate = parseDateOnlyToUtc(newDateOnly, false);
        if (newDate >= startDate && newDate <= endDate) {
          return res.status(400).json({ status: 'ERROR', message: 'New date cannot be inside the closure range' });
        }
        if (isBranchClosedOnDateOnly(branch as any, newDateOnly)) {
          return res.status(400).json({
            status: 'ERROR',
            message: 'New date falls on an existing branch closure. Select a date when the branch is open.',
          });
        }

        const targetDayStart = parseDateOnlyToUtc(newDateOnly, false);
        const targetDayEnd = parseDateOnlyToUtc(newDateOnly, true);

        const duplicateKey = new Set<string>();
        for (const appt of affectedAppointments as any[]) {
          const vetId = appt.vetId ? appt.vetId.toString() : '';
          const key = `${vetId}:${appt.startTime}`;
          if (duplicateKey.has(key) && vetId) {
            return res.status(409).json({
              status: 'ERROR',
              message: `Reschedule conflict: multiple affected appointments share time ${appt.startTime} for the same vet`,
            });
          }
          duplicateKey.add(key);
        }

        for (const appt of affectedAppointments as any[]) {
          if (!appt.vetId) continue;
          const conflict = await Appointment.findOne({
            _id: { $ne: appt._id },
            vetId: appt.vetId,
            clinicId: clinic._id,
            date: { $gte: targetDayStart, $lte: targetDayEnd },
            startTime: appt.startTime,
            status: { $in: ACTIVE_APPOINTMENT_STATUSES },
            isEmergency: false,
          }).select('_id');

          if (conflict) {
            return res.status(409).json({
              status: 'ERROR',
              message: `Selected date has slot conflicts for one or more appointments (${appt.startTime})`,
            });
          }
        }

        for (const appt of affectedAppointments as any[]) {
          const previousDate = appt.date;
          const previousStartTime = appt.startTime;
          appt.date = targetDayStart;
          appt.status = 'rescheduled';
          await appt.save();

          if (appt.ownerId?.email) {
            sendClinicClosureRescheduled({
              ownerEmail: appt.ownerId.email,
              ownerFirstName: appt.ownerId.firstName || 'Pet Owner',
              petName: appt.petId?.name || 'your pet',
              previousDate,
              previousStartTime,
              newDate: targetDayStart,
              newStartTime: appt.startTime,
            }).catch((err) => console.error('[applyBranchClosure] reschedule email failed:', err));
          }
        }
      }

      if (action === 'cancel') {
        for (const appt of affectedAppointments as any[]) {
          appt.status = 'cancelled';
          await appt.save();

          if (appt.ownerId?.email) {
            sendClinicClosureCancellation({
              ownerEmail: appt.ownerId.email,
              ownerFirstName: appt.ownerId.firstName || 'Pet Owner',
              petName: appt.petId?.name || 'your pet',
              date: appt.date,
              startTime: appt.startTime,
            }).catch((err) => console.error('[applyBranchClosure] cancellation email failed:', err));
          }
        }
      }
    }

    const closureType = startDateOnly === endDateOnly ? 'single-day' : 'date-range';
    branch.closureDates = [
      ...(branch.closureDates || []),
      { startDate, endDate, closureType, createdAt: new Date() },
    ] as any;
    await branch.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Branch closure applied successfully',
      data: {
        closureType,
        startDate: startDateOnly,
        endDate: endDateOnly,
        affectedCount: affectedAppointments.length,
        action: action || null,
      },
    });
  } catch (error) {
    console.error('Apply branch closure error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while applying branch closure' });
  }
};

// ==================== BRANCH EMAIL OTP ====================

/**
 * POST /api/clinics/branch-otp/send
 * Generate and send a 6-digit OTP to the given branch email address.
 */
export const sendBranchEmailOTP = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { email, branchName } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ status: 'ERROR', message: 'Email address is required' });
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid email address format' });
    }

    const storeKey = `${req.user.userId}:${trimmed}`;
    const existing = branchOtpStore.get(storeKey);

    // Reuse the existing OTP if it hasn't expired — no new email sent
    if (existing && Date.now() < existing.expiresAt) {
      return res.status(200).json({ status: 'SUCCESS', message: 'OTP already sent. Please check your email.' });
    }

    // Generate a fresh 6-digit OTP (5-minute window)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    branchOtpStore.set(storeKey, { otp, expiresAt });

    await sendBranchOTP({ branchEmail: trimmed, otp, branchName });

    return res.status(200).json({ status: 'SUCCESS', message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send branch OTP error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to send OTP' });
  }
};

/**
 * POST /api/clinics/branch-otp/verify
 * Verify the OTP entered by the user.
 */
export const verifyBranchEmailOTP = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: 'ERROR', message: 'Email and OTP are required' });
    }

    const trimmed = email.trim().toLowerCase();
    const storeKey = `${req.user.userId}:${trimmed}`;
    const stored = branchOtpStore.get(storeKey);

    if (!stored) {
      return res.status(400).json({ status: 'ERROR', message: 'No OTP found for this email. Please request a new one.' });
    }

    if (Date.now() > stored.expiresAt) {
      branchOtpStore.delete(storeKey);
      return res.status(400).json({ status: 'ERROR', message: 'OTP has expired. Please request a new one.' });
    }

    if (stored.otp !== otp.toString().trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Incorrect OTP. Please try again.' });
    }

    // OTP verified — delete it so it cannot be reused
    branchOtpStore.delete(storeKey);

    return res.status(200).json({ status: 'SUCCESS', message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify branch OTP error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to verify OTP' });
  }
};
