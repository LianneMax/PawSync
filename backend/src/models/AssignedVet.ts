import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignedVet extends Document {
  vetId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId | null;
  clinicBranchId: mongoose.Types.ObjectId | null;
  clinicName: string;
  clinicAddress: string | null;
  assignedAt: Date;
  isActive: boolean;
  lastVisit: Date | null;
  nextVisit: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AssignedVetSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
      index: true
    },
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null,
      index: true
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null,
      index: true
    },
    clinicName: {
      type: String,
      required: [true, 'Clinic name is required']
    },
    clinicAddress: {
      type: String,
      default: null
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastVisit: {
      type: Date,
      default: null
    },
    nextVisit: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate vet-pet assignments
AssignedVetSchema.index({ vetId: 1, petId: 1 }, { unique: true });

export default mongoose.model<IAssignedVet>('AssignedVet', AssignedVetSchema);
