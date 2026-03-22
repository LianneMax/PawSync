import mongoose, { Schema, Document } from 'mongoose';

export interface IVetLeave extends Document {
  vetId: mongoose.Types.ObjectId;
  date: Date;
  reason: string | null;
  status: 'active' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const VetLeaveSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Prevent duplicate active leave for same vet on the same date
VetLeaveSchema.index({ vetId: 1, date: 1, status: 1 });

export default mongoose.model<IVetLeave>('VetLeave', VetLeaveSchema);
