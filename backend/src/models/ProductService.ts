import mongoose, { Schema, Document } from 'mongoose';

export interface IProductService extends Document {
  name: string;
  type: 'Service' | 'Product';
  productType?: 'Medication' | 'Others';
  price: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductServiceSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: ['Service', 'Product'] },
    productType: { type: String, enum: ['Medication', 'Others'], default: 'Others' },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ProductService = mongoose.model<IProductService>('ProductService', ProductServiceSchema);

export default ProductService;
