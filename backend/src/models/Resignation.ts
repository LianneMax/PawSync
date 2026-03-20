import mongoose, { Schema, Document } from 'mongoose';

export interface IResignation extends Document {
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  backupVetId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  submittedAt: Date;
  noticeStart: Date | null;
  endDate: Date | null;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ResignationSchema = new Schema<IResignation>(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      index: true,
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: true,
      index: true,
    },
    backupVetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    noticeStart: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

ResignationSchema.index({ vetId: 1, status: 1 });
ResignationSchema.index({ clinicId: 1, clinicBranchId: 1, status: 1 });

export default mongoose.model<IResignation>('Resignation', ResignationSchema);
