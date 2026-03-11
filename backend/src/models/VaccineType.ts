import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccineType extends Document {
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;
  requiresBooster: boolean;
  numberOfBoosters: number;
  boosterIntervalDays: number | null;
  lifetimeBooster: boolean;
  minAgeMonths: number;
  minAgeUnit: 'weeks' | 'months';
  maxAgeMonths: number | null;
  maxAgeUnit: 'weeks' | 'months';
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
    lifetimeBooster: {
      type: Boolean,
      default: false,
    },
    minAgeMonths: {
      type: Number,
      default: 0,
    },
    minAgeUnit: {
      type: String,
      enum: ['weeks', 'months'],
      default: 'months',
    },
    maxAgeMonths: {
      type: Number,
      default: null,
    },
    maxAgeUnit: {
      type: String,
      enum: ['weeks', 'months'],
      default: 'months',
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

// Create compound unique index for name + species combination
VaccineTypeSchema.index({ name: 1, species: 1 }, { unique: true });

export default mongoose.model<IVaccineType>('VaccineType', VaccineTypeSchema);
