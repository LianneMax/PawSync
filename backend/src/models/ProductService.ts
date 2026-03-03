import mongoose, { Schema, Document } from 'mongoose';

export interface IProductService extends Document {
  name: string;
  type: 'Service' | 'Product';
  price: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductServiceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Product/Service name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Service', 'Product'],
      required: [true, 'Type is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ProductServiceSchema.index({ type: 1 });
ProductServiceSchema.index({ name: 'text' });

export default mongoose.model<IProductService>('ProductService', ProductServiceSchema);
