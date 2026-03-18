import mongoose, { Schema, Document } from 'mongoose';

export type ProductCategory = 'Medication' | 'Others';
export type ServiceCategory = 'Diagnostic Tests' | 'Preventive Care' | 'Surgeries' | 'Pregnancy Delivery' | 'Others';
export type AdministrationRoute = 'oral' | 'topical' | 'injection' | 'preventive';
export type AdministrationMethod =
  | 'tablets' | 'capsules' | 'syrup'                             // oral
  | 'skin' | 'ears' | 'eyes' | 'wounds'                         // topical
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

  // Net content/volume per piece (tablets/capsules → mg; syrup/topical/injection → mL)
  netContent?: number;        // e.g. 500 (mg per tablet) or 100 (mL per vial)

  // Internal dose basis for mg/kg workflow
  dosePerKg?: number;         // e.g. 10 → "10 mg/kg"
  doseUnit?: string;          // e.g. 'mg', 'mL', 'drops', 'tablet'

  // Pre-filled defaults (guide values, editable per case)
  dosageAmount?: string;      // e.g. "500mg", "5mL" — computed guide value
  frequencyNotes?: string;    // free-text frequency for topical (e.g. "apply twice daily to affected area")
  frequency?: number | null;  // doses per day (null = interval-based or as-needed)
  frequencyLabel?: string;    // e.g. "every 12 hours", "as needed", "once monthly"
  duration?: number | null;   // treatment duration in days (null = open-ended)
  durationLabel?: string;     // e.g. "28 days", "until healed", "as directed"

  // Preventive-specific
  intervalDays?: number;      // days until next due (for scheduling)
  weightMin?: number;         // kg — lower bound for weight-range-based preventives
  weightMax?: number;         // kg — upper bound for weight-range-based preventives
  associatedServiceId?: mongoose.Types.ObjectId;  // linked Preventive Care service
  preventiveDuration?: number;                    // how long the protection lasts
  preventiveDurationUnit?: 'months' | 'years';    // unit for preventiveDuration

  // Pricing type for applicable medications (tablets, capsules, spot-on, chewable)
  pricingType?: 'singlePill' | 'pack';  // singlePill = price per pill; pack = price per pack
  piecesPerPack?: number;               // number of pieces in pack (required when pricingType is 'pack')

  // Injection-specific pricing
  injectionPricingType?: 'singleDose' | 'mlPerKg';  // singleDose = price per dose; mlPerKg = price per mL/kg (uses netContent for dose volume)

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
      enum: ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Pregnancy Delivery', 'General Consultation', 'Grooming', 'Others'],
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
      enum: ['tablets', 'capsules', 'syrup', 'skin', 'ears', 'eyes', 'wounds', 'iv', 'im', 'sc', 'spot-on', 'chewable'],
      default: null,
    },
    netContent: { type: Number, default: null, min: 0 },
    dosePerKg: { type: Number, default: null, min: 0 },
    doseUnit: { type: String, default: null },
    dosageAmount: { type: String, default: null },
    frequencyNotes: { type: String, default: null },
    frequency: { type: Number, default: null, min: 1 },
    frequencyLabel: { type: String, default: null },
    duration: { type: Number, default: null, min: 1 },
    durationLabel: { type: String, default: null },
    intervalDays: { type: Number, default: null, min: 1 },
    weightMin: { type: Number, default: null, min: 0 },
    weightMax: { type: Number, default: null, min: 0 },
    associatedServiceId: { type: Schema.Types.ObjectId, ref: 'ProductService', default: null },
    preventiveDuration: { type: Number, default: null, min: 1 },
    preventiveDurationUnit: { type: String, enum: ['months', 'years'], default: null },
    pricingType: {
      type: String,
      enum: ['singlePill', 'pack'],
      default: 'singlePill',
    },
    piecesPerPack: { type: Number, default: null, min: 1 },
    injectionPricingType: {
      type: String,
      enum: ['singleDose', 'mlPerKg'],
      default: null,
    },
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
