import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';

/**
 * Update a clinic branch's active status based on whether it has assigned vets
 * If a branch has no active vets, mark it as inactive
 * If a branch has active vets, ensure it's marked as active
 */
export const updateBranchStatus = async (branchId: string): Promise<boolean> => {
  try {
    // Count active vets assigned to this branch
    const vetCount = await AssignedVet.countDocuments({
      clinicBranchId: branchId,
      isActive: true
    });

    const branch = await ClinicBranch.findById(branchId);
    if (!branch) {
      return false;
    }

    // If no vets, mark as inactive; otherwise mark as active
    const shouldBeActive = vetCount > 0;

    if (branch.isActive !== shouldBeActive) {
      branch.isActive = shouldBeActive;
      await branch.save();
    }

    return true;
  } catch (error) {
    console.error('Error updating branch status:', error);
    return false;
  }
};

/**
 * Update active status for all branches in a clinic
 */
export const updateClinicBranchStatuses = async (clinicId: string): Promise<boolean> => {
  try {
    const branches = await ClinicBranch.find({ clinicId });

    for (const branch of branches) {
      await updateBranchStatus(branch._id.toString());
    }

    return true;
  } catch (error) {
    console.error('Error updating clinic branch statuses:', error);
    return false;
  }
};
