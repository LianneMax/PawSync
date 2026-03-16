import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClinicBranch from '../src/models/ClinicBranch';
import AssignedVet from '../src/models/AssignedVet';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    console.log('\nUpdating branch statuses based on vet assignments...');

    // Get all branches
    const branches = await ClinicBranch.find({});
    console.log(`Found ${branches.length} branches`);

    let updated = 0;
    let unchanged = 0;

    for (const branch of branches) {
      // Count active vets assigned to this branch
      const vetCount = await AssignedVet.countDocuments({
        clinicBranchId: branch._id,
        isActive: true
      });

      const shouldBeActive = vetCount > 0;
      const wasActive = branch.isActive;

      if (branch.isActive !== shouldBeActive) {
        branch.isActive = shouldBeActive;
        await branch.save();
        console.log(
          `✓ ${branch.name}: ${wasActive ? 'ACTIVE' : 'INACTIVE'} → ${shouldBeActive ? 'ACTIVE' : 'INACTIVE'} (${vetCount} vets)`
        );
        updated++;
      } else {
        unchanged++;
      }
    }

    console.log(`\nUpdate complete: ${updated} branches updated, ${unchanged} unchanged`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
