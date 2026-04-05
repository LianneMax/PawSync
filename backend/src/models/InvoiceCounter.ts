import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceCounter extends Document {
  clinicId: mongoose.Types.ObjectId;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceCounterSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      unique: true,
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IInvoiceCounter>('InvoiceCounter', InvoiceCounterSchema);
