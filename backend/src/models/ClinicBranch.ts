import mongoose, { Schema, Document } from 'mongoose';

export interface IClinicBranch extends Document {
  clinicId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicBranchSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Branch address is required']
    },
    phone: {
      type: String,
      default: null
    },
    email: {
      type: String,
      default: null,
      lowercase: true
    },
    isMain: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one main branch per clinic
ClinicBranchSchema.index(
  { clinicId: 1, isMain: 1 },
  { unique: true, partialFilterExpression: { isMain: true } }
);

export default mongoose.model<IClinicBranch>('ClinicBranch', ClinicBranchSchema);
