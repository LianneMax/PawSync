import mongoose, { Document, Schema } from 'mongoose';

export interface IReferral extends Document {
  petId: mongoose.Types.ObjectId;
  medicalRecordId: mongoose.Types.ObjectId;
  referringVetId: mongoose.Types.ObjectId;
  referredVetId: mongoose.Types.ObjectId;
  referringBranchId: mongoose.Types.ObjectId;
  referredBranchId: mongoose.Types.ObjectId;
  reason: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
    medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord', required: true },
    referringVetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredVetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referringBranchId: { type: Schema.Types.ObjectId, ref: 'ClinicBranch', required: true },
    referredBranchId: { type: Schema.Types.ObjectId, ref: 'ClinicBranch', required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model<IReferral>('Referral', ReferralSchema);
