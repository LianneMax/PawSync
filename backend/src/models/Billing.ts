import mongoose, { Schema, Document } from 'mongoose';

export interface IBillingItem {
  productServiceId: mongoose.Types.ObjectId | null;
  vaccineTypeId?: mongoose.Types.ObjectId | null;
  name: string;
  type: 'Service' | 'Product';
  unitPrice: number;
  quantity: number;
}

export interface IBilling extends Document {
  ownerId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId | null;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  medicalRecordId: mongoose.Types.ObjectId | null;
  appointmentId: mongoose.Types.ObjectId | null;
  items: IBillingItem[];
  subtotal: number;
  discount: number;
  totalAmountDue: number;
  status: 'pending_payment' | 'paid';
  paidAt: Date | null;
  amountPaid: number | null;
  paymentMethod: 'cash' | 'card' | 'qr' | null;
  serviceLabel: string;
  serviceDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillingItemSchema = new Schema(
  {
    productServiceId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductService',
      default: null,
    },
    vaccineTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'VaccineType',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
    },
    type: {
      type: String,
      enum: ['Service', 'Product'],
      required: [true, 'Item type is required'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: true }
);

const BillingSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Pet owner is required'],
      index: true,
    },
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true,
    },
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true,
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: [true, 'Clinic branch is required'],
    },
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      default: null,
      index: true,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    items: {
      type: [BillingItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmountDue: {
      type: Number,
      required: [true, 'Total amount due is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending_payment', 'paid'],
      default: 'pending_payment',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    amountPaid: {
      type: Number,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'qr', null],
      default: null,
    },
    serviceLabel: {
      type: String,
      default: '',
    },
    serviceDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Clinic admin view: all billings for a clinic, sorted by latest
BillingSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
// Vet view: billings assigned to this vet
BillingSchema.index({ vetId: 1, status: 1, createdAt: -1 });
// Pet owner view: invoices for this owner
BillingSchema.index({ ownerId: 1, createdAt: -1 });

export default mongoose.model<IBilling>('Billing', BillingSchema);
