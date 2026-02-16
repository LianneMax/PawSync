import mongoose, { Schema, Document } from 'mongoose';

export interface IVetVerification extends Document {
  vetId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  prcLicenseNumber: string;
  profession: string;
  registrationDate: Date;
  expirationDate: Date;
  prcIdPhoto: string | null;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  clinicId: mongoose.Types.ObjectId | null;
  branchId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VetVerificationSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
      index: true
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    middleName: {
      type: String,
      default: null,
      trim: true
    },
    suffix: {
      type: String,
      default: null,
      trim: true
    },
    prcLicenseNumber: {
      type: String,
      required: [true, 'PRC license number is required'],
      trim: true
    },
    profession: {
      type: String,
      default: 'Veterinarian',
      trim: true
    },
    registrationDate: {
      type: Date,
      required: [true, 'Registration date is required']
    },
    expirationDate: {
      type: Date,
      required: [true, 'Expiration date is required']
    },
    prcIdPhoto: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true
    },
    rejectionReason: {
      type: String,
      default: null
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null,
      index: true
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for finding verifications by clinic and status
VetVerificationSchema.index({ clinicId: 1, status: 1 });

export default mongoose.model<IVetVerification>('VetVerification', VetVerificationSchema);
