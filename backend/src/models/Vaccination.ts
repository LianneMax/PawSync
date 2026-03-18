import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccination extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId | null;
  appointmentId: mongoose.Types.ObjectId | null;
  medicalRecordId: mongoose.Types.ObjectId | null;
  boosterAppointmentId: mongoose.Types.ObjectId | null;

  /** Sequential dose number across all records for this vaccine+pet. Starts at 1. */
  doseNumber: number;

  /**
   * 0  = still in series (or initial single dose)
   * 1+ = booster number (1st booster, 2nd booster, …)
   *
   * Computed by the controller from doseNumber and vaccineType.isSeries / totalSeries.
   */
  boosterNumber: number;

  // Vaccine identity
  vaccineTypeId: mongoose.Types.ObjectId | null;
  vaccineName: string;
  manufacturer: string;
  batchNumber: string;
  route: 'subcutaneous' | 'intramuscular' | 'intranasal' | 'oral' | null;
  administeredDoseMl: number | null;

  // Dates
  dateAdministered: Date | null;
  expiryDate: Date | null;
  nextDueDate: Date | null;

  // Status
  status: 'active' | 'expired' | 'overdue' | 'pending';
  isUpToDate: boolean; // kept for backward compat

  // Notes
  notes: string;
  verifyToken: string | null;
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
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      default: null,
    },
    boosterAppointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    doseNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    boosterNumber: {
      type: Number,
      default: 0,
      min: 0,
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
    administeredDoseMl: {
      type: Number,
      default: null,
      min: 0,
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
      enum: ['active', 'expired', 'overdue', 'pending'],
      default: 'pending',
    },
    isUpToDate: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: '',
    },
    verifyToken: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

VaccinationSchema.index({ petId: 1, dateAdministered: -1 });
VaccinationSchema.index({ status: 1, nextDueDate: 1 });
VaccinationSchema.index({ petId: 1, vaccineTypeId: 1, doseNumber: -1 });

/**
 * Compute status from dates. Exported so controllers can call it on GET too.
 */
export function computeVaccinationStatus(
  vax: Pick<IVaccination, 'dateAdministered' | 'expiryDate' | 'nextDueDate'>
): IVaccination['status'] {
  const now = new Date();
  if (!vax.dateAdministered) return 'pending';
  if (vax.expiryDate && vax.expiryDate < now) return 'expired';
  if (vax.nextDueDate && vax.nextDueDate < now) return 'overdue';
  return 'active';
}

/**
 * Before saving, recompute status and sync isUpToDate for backward compat.
 */
VaccinationSchema.pre('save', function (this: IVaccination) {
  this.status = computeVaccinationStatus(this);
  this.isUpToDate = this.status === 'active';
});

export default mongoose.model<IVaccination>('Vaccination', VaccinationSchema);
