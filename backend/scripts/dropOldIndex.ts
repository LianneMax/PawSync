import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://PawSync_admin:PawSync2025!@pawsync.kw7lflf.mongodb.net/test';

async function dropOldIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.collection('vaccinetypes');

    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    console.log(indexes);

    // Drop the old name_1 unique index if it exists
    console.log('\n🗑️  Attempting to drop old name_1 unique index...');
    try {
      await collection.dropIndex('name_1');
      console.log('✅ Successfully dropped name_1 index');
    } catch (err: any) {
      if (err.message.includes('index not found')) {
        console.log('ℹ️  Index name_1 not found (already dropped)');
      } else {
        throw err;
      }
    }

    console.log('\n📋 Indexes after dropping:');
    const indexesAfter = await collection.indexes();
    console.log(indexesAfter);

    console.log('\n✨ Done!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropOldIndex();
