import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let gridfsBucket: GridFSBucket;

/**
 * Connect to MongoDB and initialize GridFS bucket
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    
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

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

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