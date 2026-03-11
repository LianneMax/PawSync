import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccineType extends Document {
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;
  requiresBooster: boolean;
  numberOfBoosters: number;
  boosterIntervalDays: number | null;
  minAgeMonths: number;
  maxAgeMonths: number | null;
  route: string | null;
  pricePerDose: number;
  defaultManufacturer: string | null;
  defaultBatchNumber: string | null;
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
    numberOfBoosters: {
      type: Number,
      default: 0,
      min: 0,
    },
    boosterIntervalDays: {
      type: Number,
      default: null,
    },
    minAgeMonths: {
      type: Number,
      default: 0,
    },
    maxAgeMonths: {
      type: Number,
      default: null,
    },
    route: {
      type: String,
      default: null,
    },
    pricePerDose: {
      type: Number,
      default: 0,
      min: 0,
    },
    defaultManufacturer: {
      type: String,
      default: null,
    },
    defaultBatchNumber: {
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
