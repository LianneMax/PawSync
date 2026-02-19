import { Request, Response } from 'express';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import VetApplication from '../models/VetApplication';
import User from '../models/User';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';

// ==================== CLINIC ====================

/**
 * Get clinics managed by the authenticated admin
 */
export const getMyClinics = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinics = await Clinic.find({ adminId: req.user.userId, isActive: true }).sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { clinics }
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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const branches = await ClinicBranch.find({ clinicId: clinic._id })
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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

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

// ==================== VET ASSIGNMENT ====================

/**
 * Assign a vet to a clinic branch (clinic admin approves vet registration)
 */
export const assignVetToBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

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
 * Get dashboard stats for the clinic admin
 */
export const getClinicDashboardStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const [branchCount, approvedVetCount, pendingApplicationCount] = await Promise.all([
      ClinicBranch.countDocuments({ clinicId: clinic._id, isActive: true }),
      VetApplication.countDocuments({ clinicId: clinic._id, status: 'approved' }),
      VetApplication.countDocuments({ clinicId: clinic._id, status: 'pending' }),
    ]);

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        clinic: {
          _id: clinic._id,
          name: clinic.name,
        },
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
 * Get approved vets for a clinic (with their details)
 */
export const getClinicVets = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const approvedApplications = await VetApplication.find({
      clinicId: clinic._id,
      status: 'approved'
    })
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
 * Get all patients (pets) for a clinic
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

    const clinic = await Clinic.findOne({ _id: req.params.clinicId, adminId: req.user.userId });

    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    // Get all medical records for this clinic
    const medicalRecords = await MedicalRecord.find({ clinicId: clinic._id })
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
