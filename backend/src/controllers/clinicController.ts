import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import VetApplication from '../models/VetApplication';
import User from '../models/User';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';

/**
 * Helper: get clinic for the authenticated admin using clinicId from JWT.
 * Multiple fallbacks handle stale JWTs that may be missing clinicId/branchId.
 */
async function getClinicForAdmin(req: Request): Promise<any> {
  if (req.user?.clinicId) {
    return Clinic.findOne({ _id: req.user.clinicId, isActive: true });
  }
  // Branch-admin fallback: derive clinic from their branch document (JWT has branchId)
  if (req.user?.branchId) {
    const branch = await ClinicBranch.findById(req.user.branchId).select('clinicId');
    if (branch?.clinicId) {
      return Clinic.findOne({ _id: branch.clinicId, isActive: true });
    }
  }
  // Stale-JWT fallback: look up branchId/clinicId from the User document via userId
  if (req.user?.userId && req.user?.userType === 'branch-admin') {
    const dbUser = await User.findById(req.user.userId).select('clinicId branchId');
    if (dbUser?.clinicId) {
      return Clinic.findOne({ _id: dbUser.clinicId, isActive: true });
    }
    if (dbUser?.branchId) {
      const branch = await ClinicBranch.findById(dbUser.branchId).select('clinicId');
      if (branch?.clinicId) {
        return Clinic.findOne({ _id: branch.clinicId, isActive: true });
      }
    }
  }
  // Legacy fallback: look up by adminId (clinic-admin accounts)
  return Clinic.findOne({ adminId: req.user?.userId, isActive: true });
}

/**
 * Helper: resolve the branchId for a branch-admin, even if missing from JWT.
 */
async function getBranchIdForAdmin(req: Request): Promise<string | undefined> {
  if (req.user?.branchId) return req.user.branchId;
  if (req.user?.clinicBranchId) return req.user.clinicBranchId;
  // Stale-JWT: look up from User document
  if (req.user?.userId && req.user?.userType === 'branch-admin') {
    const dbUser = await User.findById(req.user.userId).select('branchId');
    if (dbUser?.branchId) return dbUser.branchId.toString();
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
 * Get all patients (pets) for a clinic or branch, derived from appointments.
 * Accessible by: clinic-admin, branch-admin.
 * Branch-admins see only patients who have had appointments at their branch.
 */
export const getClinicPatients = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    if (req.user.userType !== 'clinic-admin' && req.user.userType !== 'branch-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Only clinic or branch admins can access this' });
    }

    const clinic = await getClinicForAdmin(req);

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // branch-admin: filter by their branch; clinic-admin: optionally filter by clinicBranchId
    // getBranchIdForAdmin handles stale JWTs by falling back to the User document
    const branchId = req.user.userType === 'branch-admin'
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
