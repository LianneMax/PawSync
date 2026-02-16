import mongoose, { Schema, Document } from 'mongoose';

export interface IClinicBranch extends Document {
  clinicId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  openingTime: string | null;
  closingTime: string | null;
  operatingDays: string[];
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
    city: {
      type: String,
      default: null,
      trim: true
    },
    province: {
      type: String,
      default: null,
      trim: true
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
    openingTime: {
      type: String,
      default: null
    },
    closingTime: {
      type: String,
      default: null
    },
    operatingDays: {
      type: [String],
      default: [],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
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
