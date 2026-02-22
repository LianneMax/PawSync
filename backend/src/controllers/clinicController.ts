import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import VetApplication from '../models/VetApplication';
import User from '../models/User';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';

/**
 * Helper: get clinic for the authenticated admin using clinicId from JWT.
 * Falls back to legacy adminId lookup for backwards compatibility.
 */
async function getClinicForAdmin(req: Request) {
  if (req.user?.clinicId) {
    return Clinic.findOne({ _id: req.user.clinicId, isActive: true });
  }
  // Legacy fallback: look up by adminId
  return Clinic.findOne({ adminId: req.user?.userId, isActive: true });
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
        const branches = await ClinicBranch.find({ clinicId: clinic._id, isActive: true })
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

    const { name, address, city, province, phone, email, openingTime, closingTime, operatingDays, isMain } = req.body;

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

    // Update clinic's mainBranchId if this is the new main
    if (isMain) {
      await Clinic.findByIdAndUpdate(clinic._id, { mainBranchId: branch._id });
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
export const createBranchAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { email, password, firstName, lastName, branchId } = req.body;

    if (!email || !password || !firstName || !lastName || !branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide email, password, firstName, lastName, and branchId' });
    }

    // Verify the branch belongs to this clinic
    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id, isActive: true });
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
      userType: 'branch-admin',
      clinicId: clinic._id,
      branchId: branchId,
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
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the branch admin' });
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

    const branch = await ClinicBranch.findOne({ _id: branchId, clinicId: clinic._id, isActive: true });

    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Check if the vet is already assigned to this branch
    const existing = await AssignedVet.findOne({ vetId, clinicBranchId: branchId, isActive: true });

    if (existing) {
      return res.status(400).json({ status: 'ERROR', message: 'Vet is already assigned to this branch' });
    }

    const assignment = await AssignedVet.create({
      vetId,
      clinicId: clinic._id,
      clinicBranchId: branchId,
      clinicName: clinic.name,
      clinicAddress: branch.address,
      assignedAt: new Date()
    });

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

    const branchId = req.user.clinicBranchId;

    // Build branch-filtered query
    const branchFilter = branchId ? { branchId } : {};
    const vetAppFilter: any = { clinicId: clinic._id };
    if (branchId) {
      vetAppFilter.branchId = branchId;
    }

    const [branchCount, approvedVetCount, pendingApplicationCount] = await Promise.all([
      branchId
        ? ClinicBranch.countDocuments({ _id: branchId, clinicId: clinic._id, isActive: true })
        : ClinicBranch.countDocuments({ clinicId: clinic._id, isActive: true }),
      VetApplication.countDocuments({ ...vetAppFilter, status: 'approved' }),
      VetApplication.countDocuments({ ...vetAppFilter, status: 'pending' }),
    ]);

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
          totalVeterinarians: approvedVetCount,
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
 * Get approved vets for a clinic (filtered by branch)
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

    const vetAppFilter: any = { clinicId: clinic._id, status: 'approved' };
    if (req.user.clinicBranchId) {
      vetAppFilter.branchId = req.user.clinicBranchId;
    }

    const approvedApplications = await VetApplication.find(vetAppFilter)
      .populate('vetId', 'firstName lastName email')
      .populate('branchId', 'name')
      .populate('verificationId', 'prcLicenseNumber')
      .sort({ createdAt: -1 });

    const vets = approvedApplications.map((app) => {
      const vet = app.vetId as any;
      const branch = app.branchId as any;
      const verification = app.verificationId as any;

      return {
        _id: app._id,
        vetId: vet?._id || null,
        name: vet ? `Dr. ${vet.firstName} ${vet.lastName}` : 'Unknown',
        email: vet?.email || '',
        initials: vet ? `${vet.firstName?.[0] || ''}${vet.lastName?.[0] || ''}` : '??',
        branch: branch?.name || 'Unassigned',
        prcLicense: verification?.prcLicenseNumber || '-',
        status: 'Active',
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
 * Get all patients (pets) for a clinic (filtered by branch)
 */
export const getClinicPatients = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    // Only clinic admins can access this
    if (req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Only clinic admins can access this' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Filter medical records by branch if branch admin
    const recordFilter: any = { clinicId: clinic._id };
    if (req.user.clinicBranchId) {
      recordFilter.clinicBranchId = req.user.clinicBranchId;
    }

    // Get all medical records for this clinic/branch
    const medicalRecords = await MedicalRecord.find(recordFilter)
      .populate('petId')
      .populate('vetId', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Extract unique pets with their owners
    const petMap = new Map();

    for (const record of medicalRecords) {
      const pet = record.petId as any;
      if (pet && !petMap.has(pet._id.toString())) {
        petMap.set(pet._id.toString(), pet);
      }
    }

    // Populate owner details for all pets
    const pets = Array.from(petMap.values());
    const petsWithOwners = await Promise.all(
      pets.map(async (pet: any) => {
        const owner = await User.findById(pet.ownerId).select('firstName lastName contactNumber email');
        return {
          _id: pet._id,
          name: pet.name,
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
          recordCount: medicalRecords.filter((r: any) => r.petId._id.toString() === pet._id.toString()).length,
          lastVisit: medicalRecords.find((r: any) => r.petId._id.toString() === pet._id.toString())?.createdAt
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
