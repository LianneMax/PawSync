import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import AssignedVet from '../models/AssignedVet';

let gridfsBucket: GridFSBucket;

/**
 * Connect to MongoDB and initialize GridFS bucket
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Check if MONGODB_URI exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Connect to MongoDB with options to bypass SRV DNS lookups
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      directConnection: false,
      retryWrites: true,
      w: 'majority',
      srvServiceName: 'mongodb',
      // Add DNS options
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Ensure database is available before initializing GridFS
    const db = conn.connection.db;
    
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Initialize GridFS bucket for file storage (images, PDFs, etc.)
    gridfsBucket = new GridFSBucket(db, {
      bucketName: 'uploads' // Files stored in 'uploads.files' and 'uploads.chunks'
    });

    console.log('✅ GridFS Bucket initialized');

    // Sync indexes for models with updated index definitions
    try {
      await AssignedVet.syncIndexes();
    } catch (indexError) {
      console.warn('⚠️ Could not sync indexes (non-fatal):', indexError);
    }

  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1); // Exit process with failure
  }
};

/**
 * Get the initialized GridFS bucket
 * Used for uploading/downloading files to MongoDB
 */
export const getGridFSBucket = (): GridFSBucket => {
  if (!gridfsBucket) {
    throw new Error('GridFS Bucket not initialized. Call connectDatabase first.');
  }
  return gridfsBucket;
};

/**
 * Close database connection gracefully
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📴 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});