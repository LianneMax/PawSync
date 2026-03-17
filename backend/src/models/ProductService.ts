import mongoose, { Schema, Document } from 'mongoose';

export type ProductCategory = 'Medication' | 'Others';
export type ServiceCategory = 'Diagnostic Tests' | 'Preventive Care' | 'Surgeries' | 'Others';
export type AdministrationRoute = 'oral' | 'topical' | 'injection' | 'preventive';
export type AdministrationMethod =
  | 'pills' | 'capsules' | 'tablets' | 'liquid' | 'suspension'  // oral
  | 'skin' | 'eyes' | 'ears'                                     // topical
  | 'iv' | 'im' | 'sc'                                           // injection (IV, IM, subcutaneous)
  | 'spot-on' | 'chewable';                                      // preventive

export interface IBranchAvailability {
  branchId: mongoose.Types.ObjectId;
  isActive: boolean;
}

export interface IProductService extends Document {
  name: string;
  type: 'Service' | 'Product';
  category: ProductCategory | ServiceCategory;
  price: number;
  description: string;
  isActive: boolean;
  administrationRoute?: AdministrationRoute;
  administrationMethod?: AdministrationMethod;

  // Internal dose basis for mg/kg workflow
  dosePerKg?: number;         // e.g. 10 → "10 mg/kg"
  doseUnit?: string;          // e.g. 'mg', 'mL', 'drops', 'tablet'

  // Pre-filled defaults (guide values, editable per case)
  dosageAmount?: string;      // e.g. "500mg", "5mL" — computed guide value
  frequency?: number | null;  // doses per day (null = interval-based or as-needed)
  frequencyLabel?: string;    // e.g. "every 12 hours", "as needed", "once monthly"
  duration?: number | null;   // treatment duration in days (null = open-ended)
  durationLabel?: string;     // e.g. "28 days", "until healed", "as directed"

  // Preventive-specific
  intervalDays?: number;      // days until next due (for scheduling)
  weightMin?: number;         // kg — lower bound for weight-range-based preventives
  weightMax?: number;         // kg — upper bound for weight-range-based preventives

  branchAvailability: IBranchAvailability[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductServiceSchema: Schema = new Schema(
  {
    // Note: unique constraint removed from name to support medication variants.
    // Uniqueness is enforced at the application level based on category.
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['Service', 'Product'] },
    category: {
      type: String,
      required: true,
      enum: ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'General Consultation', 'Grooming', 'Others'],
      default: 'Others',
    },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    administrationRoute: {
      type: String,
      enum: ['oral', 'topical', 'injection', 'preventive'],
      default: null,
    },
    administrationMethod: {
      type: String,
      enum: ['pills', 'capsules', 'tablets', 'liquid', 'suspension', 'skin', 'eyes', 'ears', 'iv', 'im', 'sc', 'spot-on', 'chewable'],
      default: null,
    },
    dosePerKg: { type: Number, default: null, min: 0 },
    doseUnit: { type: String, default: null },
    dosageAmount: { type: String, default: null },
    frequency: { type: Number, default: null, min: 1 },
    frequencyLabel: { type: String, default: null },
    duration: { type: Number, default: null, min: 1 },
    durationLabel: { type: String, default: null },
    intervalDays: { type: Number, default: null, min: 1 },
    weightMin: { type: Number, default: null, min: 0 },
    weightMax: { type: Number, default: null, min: 0 },
    // Branch availability: tracks which branches carry this item and whether it's active there.
    // Applicable to Medications (Products) and all Services (including Others).
    branchAvailability: [
      {
        branchId: { type: Schema.Types.ObjectId, ref: 'ClinicBranch', required: true },
        isActive: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for performance on variant lookups
ProductServiceSchema.index({ name: 1, category: 1, administrationRoute: 1, administrationMethod: 1 });

const ProductService = mongoose.model<IProductService>('ProductService', ProductServiceSchema);

export default ProductService;
