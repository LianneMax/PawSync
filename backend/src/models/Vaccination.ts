import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccination extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId | null;
  appointmentId: mongoose.Types.ObjectId | null;
  // Vaccine identity
  vaccineTypeId: mongoose.Types.ObjectId | null;
  vaccineName: string;
  manufacturer: string;
  batchNumber: string;
  route: 'subcutaneous' | 'intramuscular' | 'intranasal' | 'oral' | null;
  // Dates
  dateAdministered: Date | null;
  expiryDate: Date | null;
  nextDueDate: Date | null;
  // Status
  status: 'active' | 'expired' | 'overdue' | 'pending' | 'declined';
  isUpToDate: boolean; // kept for backward compat
  // Decline info
  declinedReason: string | null;
  declinedBy: mongoose.Types.ObjectId | null;
  declinedAt: Date | null;
  // Notes
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const VaccinationSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true,
    },
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    vaccineTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'VaccineType',
      default: null,
    },
    vaccineName: {
      type: String,
      required: [true, 'Vaccine name is required'],
    },
    manufacturer: {
      type: String,
      default: '',
    },
    batchNumber: {
      type: String,
      default: '',
    },
    route: {
      type: String,
      enum: ['subcutaneous', 'intramuscular', 'intranasal', 'oral', null],
      default: null,
    },
    dateAdministered: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    nextDueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'overdue', 'pending', 'declined'],
      default: 'pending',
    },
    isUpToDate: {
      type: Boolean,
      default: true,
    },
    declinedReason: {
      type: String,
      default: null,
    },
    declinedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

VaccinationSchema.index({ petId: 1, dateAdministered: -1 });
VaccinationSchema.index({ status: 1, nextDueDate: 1 });

/**
 * Compute status from dates. Exported so controllers can call it on GET too.
 */
export function computeVaccinationStatus(
  vax: Pick<IVaccination, 'declinedAt' | 'dateAdministered' | 'expiryDate' | 'nextDueDate'>
): IVaccination['status'] {
  const now = new Date();
  if (vax.declinedAt) return 'declined';
  if (!vax.dateAdministered) return 'pending';
  if (vax.expiryDate && vax.expiryDate < now) return 'expired';
  if (vax.nextDueDate && vax.nextDueDate < now) return 'overdue';
  return 'active';
}

/**
 * Before saving, recompute status and sync isUpToDate for backward compat.
 */
VaccinationSchema.pre('save', function (next) {
  const vax = this as unknown as IVaccination;
  if (vax.status !== 'declined') {
    vax.status = computeVaccinationStatus(vax);
  }
  vax.isUpToDate = vax.status === 'active';
  next();
});

export default mongoose.model<IVaccination>('Vaccination', VaccinationSchema);
