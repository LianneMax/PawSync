import mongoose, { Schema, Document } from 'mongoose';

export interface IVetApplication extends Document {
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  verificationId: mongoose.Types.ObjectId | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VetApplicationSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
      index: true
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: [true, 'Branch is required']
    },
    verificationId: {
      type: Schema.Types.ObjectId,
      ref: 'VetVerification',
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate applications from the same vet to the same clinic
VetApplicationSchema.index({ vetId: 1, clinicId: 1 }, { unique: true });

// Index for finding applications by clinic and status
VetApplicationSchema.index({ clinicId: 1, status: 1 });

export default mongoose.model<IVetApplication>('VetApplication', VetApplicationSchema);
