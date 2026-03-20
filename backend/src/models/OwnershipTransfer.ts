import mongoose, { Schema, Document } from 'mongoose';

export interface IOwnershipTransfer extends Document {
  petId: mongoose.Types.ObjectId;
  oldOwnerId: mongoose.Types.ObjectId;
  newOwnerId: mongoose.Types.ObjectId;
  transferDate: Date;
  recordsTransferred: boolean;
  transferredBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OwnershipTransferSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    oldOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    newOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transferDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    recordsTransferred: {
      type: Boolean,
      default: true,
    },
    transferredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOwnershipTransfer>('OwnershipTransfer', OwnershipTransferSchema);
