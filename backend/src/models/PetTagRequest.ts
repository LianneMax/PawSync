import mongoose, { Schema, Document } from 'mongoose';

export interface IPetTagRequest extends Document {
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  reason: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  pickupDate?: Date;
  clinicBranchId?: mongoose.Types.ObjectId;
  fulfilledAt?: Date;
  fulfilledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PetTagRequestSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true
    },
    reason: {
      type: String,
      enum: ['lost_replacement', 'upgrade', 'additional', 'other', ''],
      default: ''
    },
    pickupDate: {
      type: Date,
      default: null
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'cancelled'],
      default: 'pending',
      index: true
    },
    fulfilledAt: {
      type: Date,
      default: null
    },
    fulfilledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for quick lookup by pet + status
PetTagRequestSchema.index({ petId: 1, status: 1 });
// Index for clinic to see all pending requests
PetTagRequestSchema.index({ clinicId: 1, status: 1, createdAt: -1 });

export default mongoose.model<IPetTagRequest>('PetTagRequest', PetTagRequestSchema);
