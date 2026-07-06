import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import AssignedVet from '../models/AssignedVet';
import User from '../models/User';
import { updateBranchStatus } from '../services/branchStatusService';

// One-time backfill: past resignation-completion runs marked vets 'inactive'
// without deactivating their AssignedVet record or recalculating branch
// status, leaving branches selectable with zero bookable vets. This finds
// those stale assignments, deactivates them, and recomputes branch.isActive.
async function main() {
  await connectDatabase();

  const staleAssignments = await AssignedVet.find({ isActive: true, clinicBranchId: { $ne: null } }).populate(
    'vetId',
    'userType resignation'
  );

  const affectedBranchIds = new Set<string>();
  let deactivatedCount = 0;

  for (const assignment of staleAssignments) {
    const vet = assignment.vetId as any;
    const isResigned = vet?.userType === 'inactive' || vet?.resignation?.status === 'completed';
    if (!vet || isResigned) {
      assignment.isActive = false;
      await assignment.save();
      deactivatedCount++;
      if (assignment.clinicBranchId) affectedBranchIds.add(assignment.clinicBranchId.toString());
    }
  }

  for (const branchId of affectedBranchIds) {
    await updateBranchStatus(branchId);
  }

  console.log(`Deactivated ${deactivatedCount} stale assignment(s) across ${affectedBranchIds.size} branch(es).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
