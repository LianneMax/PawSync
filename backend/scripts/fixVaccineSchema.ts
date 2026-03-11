/**
 * Fix script to update the VaccineType schema in MongoDB
 * - Removes old unique index on 'name'
 * - Creates new compound unique index on 'name' + 'species'
 * - Adds missing minAgeUnit and maxAgeUnit fields to existing documents
 * 
 * Usage:
 *   npx ts-node backend/scripts/fixVaccineSchema.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import VaccineType from '../src/models/VaccineType';

dotenv.config();

const fixSchema = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';
    
    console.log('🔧 Fixing VaccineType schema...');
    console.log(`📍 Connecting to: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get collection
    const collection = mongoose.connection.db?.collection('vaccinetypes');
    if (!collection) {
      throw new Error('Collection not accessible');
    }

    // Step 1: Drop old unique index on name if it exists
    console.log('\n📌 Step 1: Removing old unique index on "name"...');
    try {
      const indexes = await collection.indexes();
      const nameIndex = Object.entries(indexes).find(([_, spec]: any) => 
        spec.key && spec.key.name === 1 && spec.unique === true
      );
      
      if (nameIndex) {
        await collection.dropIndex(nameIndex[0]);
        console.log('✅ Dropped old unique index on name');
      } else {
        console.log('ℹ️  Old index on name not found (may have been already removed)');
      }
    } catch (err: any) {
      if (err.code === 27) { // Index not found
        console.log('ℹ️  Old index on name not found');
      } else {
        console.error('❌ Error dropping index:', err.message);
      }
    }

    // Step 2: Add missing fields to existing documents
    console.log('\n📌 Step 2: Adding missing minAgeUnit and maxAgeUnit fields...');
    const updateResult = await VaccineType.updateMany(
      {
        $or: [
          { minAgeUnit: { $exists: false } },
          { maxAgeUnit: { $exists: false } }
        ]
      },
      {
        $set: {
          minAgeUnit: 'months',
          maxAgeUnit: 'months'
        }
      }
    );
    console.log(`✅ Updated ${updateResult.modifiedCount} documents with default units`);

    // Step 3: Create new compound unique index
    console.log('\n📌 Step 3: Creating new compound unique index on name + species...');
    try {
      await collection.createIndex(
        { name: 1, species: 1 },
        { unique: true }
      );
      console.log('✅ Created compound unique index on (name, species)');
    } catch (err: any) {
      if (err.code === 68) { // Index already exists
        console.log('ℹ️  Compound index already exists');
      } else {
        throw err;
      }
    }

    // Step 4: Verify the schema
    console.log('\n📌 Step 4: Verifying schema changes...');
    const count = await VaccineType.countDocuments();
    const withoutUnits = await VaccineType.countDocuments({
      $or: [
        { minAgeUnit: { $exists: false } },
        { maxAgeUnit: { $exists: false } }
      ]
    });
    const indexList = await collection.indexes();

    console.log(`✅ Total vaccine types: ${count}`);
    console.log(`✅ Without units: ${withoutUnits} (should be 0)`);
    console.log(`✅ Indexes: ${indexList.length}`);

    const hasCompoundIndex = indexList.some((idx) => 
      idx.key && idx.key.name === 1 && idx.key.species === 1 && idx.unique === true
    );
    console.log(`✅ Has compound unique index on (name, species): ${hasCompoundIndex ? 'YES' : 'NO'}`);

    console.log('\n✨ Schema fix complete!');
    console.log('\n📝 Summary:');
    console.log('   • Old unique index on "name" removed');
    console.log('   • New compound unique index on (name, species) created');
    console.log('   • All documents updated with default unit values');
    console.log('   • You can now create vaccines with same name for different species');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

fixSchema();
