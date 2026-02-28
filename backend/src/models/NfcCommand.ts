/**
 * NfcCommand — represents a pending write command queued for the local agent.
 *
 * Lifecycle:
 *   pending    → created by POST /api/nfc/pet/:petId/write
 *   in_progress→ claimed by the local agent (poller picks it up)
 *   done       → agent posted a successful write result
 *   failed     → agent posted a failure result or command timed out
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INfcCommand extends Document {
  petId: Types.ObjectId;
  url: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  result?: {
    uid: string;
    writeSuccess: boolean;
    message?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NfcCommandSchema = new Schema<INfcCommand>(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    result: {
      uid: String,
      writeSuccess: Boolean,
      message: String,
    },
  },
  { timestamps: true }
);

// Compound index for the poller query (status=pending, sorted by creation)
NfcCommandSchema.index({ status: 1, createdAt: 1 });

export const NfcCommand = mongoose.model<INfcCommand>('NfcCommand', NfcCommandSchema);
