"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.getGridFSBucket = exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const AssignedVet_1 = __importDefault(require("../models/AssignedVet"));
let gridfsBucket;
/**
 * Connect to MongoDB and initialize GridFS bucket
 */
const connectDatabase = async () => {
    try {
        // Check if MONGODB_URI exists
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        // Connect to MongoDB with options to bypass SRV DNS lookups
        const conn = await mongoose_1.default.connect(process.env.MONGODB_URI, {
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
        gridfsBucket = new mongodb_1.GridFSBucket(db, {
            bucketName: 'uploads' // Files stored in 'uploads.files' and 'uploads.chunks'
        });
        console.log('✅ GridFS Bucket initialized');
        // Sync indexes for models with updated index definitions
        try {
            await AssignedVet_1.default.syncIndexes();
        }
        catch (indexError) {
            console.warn('⚠️ Could not sync indexes (non-fatal):', indexError);
        }
    }
    catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        process.exit(1); // Exit process with failure
    }
};
exports.connectDatabase = connectDatabase;
/**
 * Get the initialized GridFS bucket
 * Used for uploading/downloading files to MongoDB
 */
const getGridFSBucket = () => {
    if (!gridfsBucket) {
        throw new Error('GridFS Bucket not initialized. Call connectDatabase first.');
    }
    return gridfsBucket;
};
exports.getGridFSBucket = getGridFSBucket;
/**
 * Close database connection gracefully
 */
const closeDatabase = async () => {
    try {
        await mongoose_1.default.connection.close();
        console.log('✅ MongoDB connection closed');
    }
    catch (error) {
        console.error('❌ Error closing MongoDB connection:', error);
    }
};
exports.closeDatabase = closeDatabase;
// Handle connection events
mongoose_1.default.connection.on('connected', () => {
    console.log('📡 Mongoose connected to MongoDB');
});
mongoose_1.default.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});
mongoose_1.default.connection.on('disconnected', () => {
    console.log('📴 Mongoose disconnected from MongoDB');
});
// Graceful shutdown
process.on('SIGINT', async () => {
    await (0, exports.closeDatabase)();
    console.log('🛑 MongoDB connection closed due to app termination');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await (0, exports.closeDatabase)();
    console.log('🛑 MongoDB connection closed due to app termination');
    process.exit(0);
});
