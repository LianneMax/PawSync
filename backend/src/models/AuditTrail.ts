import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditTrail extends Document {
  action: string;
  actorUserId: mongoose.Types.ObjectId | null;
  targetUserId: mongoose.Types.ObjectId | null;
  clinicId: mongoose.Types.ObjectId | null;
  clinicBranchId: mongoose.Types.ObjectId | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditTrailSchema = new Schema<IAuditTrail>(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null,
      index: true,
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAuditTrail>('AuditTrail', AuditTrailSchema);
