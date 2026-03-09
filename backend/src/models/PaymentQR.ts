import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentQR extends Document {
  label: string;
  imageData: string; // base64 data URL (e.g. "data:image/png;base64,...")
  clinicId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentQRSchema: Schema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    imageData: { type: String, required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const PaymentQR = mongoose.model<IPaymentQR>('PaymentQR', PaymentQRSchema);

export default PaymentQR;
