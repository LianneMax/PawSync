import mongoose, { Schema, Document } from 'mongoose';

export type ProductCategory = 'Medication' | 'Others';
export type ServiceCategory = 'Diagnostic Tests' | 'Preventive Care' | 'Surgeries' | 'Others';
export type AdministrationRoute = 'oral' | 'topical' | 'injection';
export type AdministrationMethod =
  | 'pills' | 'capsules' | 'tablets' | 'liquid' | 'suspension'  // oral
  | 'skin' | 'eyes' | 'ears';                                     // topical

export interface IProductService extends Document {
  name: string;
  type: 'Service' | 'Product';
  category: ProductCategory | ServiceCategory;
  price: number;
  description: string;
  isActive: boolean;
  administrationRoute?: AdministrationRoute;
  administrationMethod?: AdministrationMethod;
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
  },
  { timestamps: true }
);

// Compound index for performance on variant lookups
ProductServiceSchema.index({ name: 1, category: 1, administrationRoute: 1, administrationMethod: 1 });

const ProductService = mongoose.model<IProductService>('ProductService', ProductServiceSchema);

export default ProductService;
