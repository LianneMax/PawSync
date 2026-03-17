import mongoose, { Schema, Document } from 'mongoose';

export type ProductCategory = 'Medication' | 'Others';
export type ServiceCategory = 'Diagnostic Tests' | 'Preventive Care' | 'Surgeries' | 'Others';
export type AdministrationRoute = 'oral' | 'topical' | 'injection';
export type AdministrationMethod =
  | 'pills' | 'capsules' | 'tablets' | 'liquid' | 'suspension'  // oral
  | 'skin' | 'eyes' | 'ears';                                     // topical

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
  intervalDays?: number; // For preventive care services, days until next due
  dosageAmount?: string;  // e.g. "500mg", "5ml" — medication standard info
  frequency?: number;     // doses per day — medication standard info
  duration?: number;      // treatment duration in days — medication standard info
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
      enum: ['oral', 'topical', 'injection'],
      default: null,
    },
    administrationMethod: {
      type: String,
      enum: ['pills', 'capsules', 'tablets', 'liquid', 'suspension', 'skin', 'eyes', 'ears'],
      default: null,
    },
    intervalDays: {
      type: Number,
      default: null,
      min: 1,
    },
    dosageAmount: { type: String, default: null },
    frequency: { type: Number, default: null, min: 1 },
    duration: { type: Number, default: null, min: 1 },
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
