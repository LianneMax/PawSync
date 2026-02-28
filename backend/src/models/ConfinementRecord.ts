import mongoose, { Schema, Document } from 'mongoose';

export interface IConfinementRecord extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId | null;
  appointmentId: mongoose.Types.ObjectId | null;
  reason: string;
  notes: string;
  admissionDate: Date;
  dischargeDate: Date | null;
  status: 'admitted' | 'discharged';
  createdAt: Date;
  updatedAt: Date;
}

const ConfinementRecordSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true,
    },
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    reason: {
      type: String,
      required: [true, 'Reason for confinement is required'],
    },
    notes: {
      type: String,
      default: '',
    },
    admissionDate: {
      type: Date,
      required: [true, 'Admission date is required'],
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['admitted', 'discharged'],
      default: 'admitted',
    },
  },
  { timestamps: true }
);

ConfinementRecordSchema.index({ petId: 1, admissionDate: -1 });
ConfinementRecordSchema.index({ status: 1, clinicId: 1 });

export default mongoose.model<IConfinementRecord>('ConfinementRecord', ConfinementRecordSchema);
