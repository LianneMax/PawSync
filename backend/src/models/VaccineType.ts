import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccineType extends Document {
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;
  requiresBooster: boolean;
  boosterIntervalDays: number | null;
  minAgeMonths: number;
  route: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VaccineTypeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Vaccine name is required'],
      unique: true,
      trim: true,
    },
    species: {
      type: [String],
      enum: ['dog', 'cat', 'all'],
      required: [true, 'At least one species is required'],
    },
    validityDays: {
      type: Number,
      required: [true, 'Validity period is required'],
      min: 1,
    },
    requiresBooster: {
      type: Boolean,
      default: false,
    },
    boosterIntervalDays: {
      type: Number,
      default: null,
    },
    minAgeMonths: {
      type: Number,
      default: 0,
    },
    route: {
      type: String,
      default: null,
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

export default mongoose.model<IVaccineType>('VaccineType', VaccineTypeSchema);
