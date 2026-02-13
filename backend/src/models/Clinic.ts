import mongoose, { Schema, Document } from 'mongoose';

export interface IClinic extends Document {
  name: string;
  adminId: mongoose.Types.ObjectId;
  address: string | null;
  phone: string | null;
  email: string | null;
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
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Clinic admin is required'],
      index: true
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
