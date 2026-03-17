import mongoose, { Schema, Document } from 'mongoose';

export interface IVetInvitation extends Document {
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  token: string;
  status: 'pending' | 'accepted';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VetInvitationSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
      index: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: [true, 'Branch is required'],
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IVetInvitation>('VetInvitation', VetInvitationSchema);
