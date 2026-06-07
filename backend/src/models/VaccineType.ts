import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccineType extends Document {
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;

  // ── Series configuration ──────────────────────────────────────────────────
  /** If true, vaccine requires multiple doses (series) before protection is complete. */
  isSeries: boolean;
  /** Number of doses in the series. Only meaningful when isSeries=true. Default 3. */
  totalSeries: number;
  /** Days between each dose in the series. Default 21. */
  seriesIntervalDays: number;

  // ── Booster configuration ─────────────────────────────────────────────────
  /**
   * If true, boosters are required after the series completes (or after the
   * initial single dose when isSeries=false). Boosters continue indefinitely
   * (lifetime) at the boosterIntervalDays interval.
   */
  boosterValid: boolean;
  /** Days between booster doses. Default 365. */
  boosterIntervalDays: number | null;

  // ── Age restrictions ──────────────────────────────────────────────────────
  minAgeMonths: number;
  minAgeUnit: 'weeks' | 'months';
  maxAgeMonths: number | null;
  maxAgeUnit: 'weeks' | 'months';

  // ── Administration ────────────────────────────────────────────────────────
  route: string | null;
  /**
   * Dose volume in mL. Auto-set by species:
   *   dog/canine  → 1.0 mL
   *   cat/feline  → 0.5 mL
   *   both        → null (set manually)
   */
  doseVolumeMl: number | null;

  // ── Metadata ──────────────────────────────────────────────────────────────
  pricePerDose: number;
  defaultManufacturer: string | null;
  defaultBatchNumber: string | null;
  /** Expiration (shelf-life) date of the current batch/lot. One batch = one expiry date. */
  defaultBatchExpirationDate: Date | null;
  isActive: boolean;

  // ── Owning clinic (used to target expiry-alert notifications) ─────────────
  clinicId: mongoose.Types.ObjectId | null;
  clinicBranchId: mongoose.Types.ObjectId | null;

  /** Tracks which batch-expiry alert thresholds have already been sent, so they fire only once per batch. */
  expiryAlertFlags: {
    sevenDay: boolean;
    threeDay: boolean;
    oneDay: boolean;
    expired: boolean;
  };

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

    // Series
    isSeries: {
      type: Boolean,
      default: false,
    },
    totalSeries: {
      type: Number,
      default: 3,
      min: 1,
    },
    seriesIntervalDays: {
      type: Number,
      default: 21,
      min: 1,
    },

    // Booster
    boosterValid: {
      type: Boolean,
      default: false,
    },
    boosterIntervalDays: {
      type: Number,
      default: null,
    },

    // Age restrictions
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

    // Administration
    route: {
      type: String,
      default: null,
    },
    doseVolumeMl: {
      type: Number,
      default: null,
    },

    // Metadata
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
    defaultBatchExpirationDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null,
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null,
    },

    expiryAlertFlags: {
      sevenDay: { type: Boolean, default: false },
      threeDay: { type: Boolean, default: false },
      oneDay: { type: Boolean, default: false },
      expired: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

VaccineTypeSchema.index({ name: 1, species: 1 }, { unique: true });

export default mongoose.model<IVaccineType>('VaccineType', VaccineTypeSchema);
