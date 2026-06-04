import mongoose, { Schema, Document } from 'mongoose';

export interface IImage extends Document {
  data: Buffer;
  contentType: string;
  folder: string;
  size: number;
  createdAt: Date;
}

const ImageSchema = new Schema<IImage>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    folder: { type: String, default: 'general' },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IImage>('Image', ImageSchema);
