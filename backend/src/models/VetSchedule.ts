import mongoose, { Schema, Document } from 'mongoose';

export interface IVetSchedule extends Document {
  vetId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  workingDays: string[];
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  createdAt: Date;
  updatedAt: Date;
}

const VetScheduleSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: true,
      index: true
    },
    workingDays: {
      type: [String],
      default: [],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// One schedule per vet per branch
VetScheduleSchema.index({ vetId: 1, branchId: 1 }, { unique: true });

export default mongoose.model<IVetSchedule>('VetSchedule', VetScheduleSchema);
