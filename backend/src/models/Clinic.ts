import mongoose, { Schema, Document } from 'mongoose';

export interface IClinic extends Document {
  name: string;
  mainBranchId: mongoose.Types.ObjectId | null;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  legalBusinessName: string | null;
  businessTaxId: string | null;
  businessRegistrationNo: string | null;
  birNumber: string | null;
  receiptFooterNote: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Clinic name is required'],
      trim: true
    },
    mainBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    },
    logo: {
      type: String,
      default: null
    },
    address: {
      type: String,
      default: null
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
    legalBusinessName: {
      type: String,
      default: null,
      trim: true
    },
    businessTaxId: {
      type: String,
      default: null,
      trim: true
    },
    businessRegistrationNo: {
      type: String,
      default: null,
      trim: true
    },
    birNumber: {
      type: String,
      default: null,
      trim: true
    },
    receiptFooterNote: {
      type: String,
      default: null,
      trim: true
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

export default mongoose.model<IClinic>('Clinic', ClinicSchema);
