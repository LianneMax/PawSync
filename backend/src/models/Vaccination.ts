import mongoose, { Schema, Document } from 'mongoose';

export interface IVaccination extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  vaccineName: string;
  dateAdministered: Date;
  nextDueDate: Date | null;
  isUpToDate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VaccinationSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true
    },
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required']
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required']
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    },
    vaccineName: {
      type: String,
      required: [true, 'Vaccine name is required']
    },
    dateAdministered: {
      type: Date,
      required: [true, 'Date administered is required']
    },
    nextDueDate: {
      type: Date,
      default: null
    },
    isUpToDate: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

VaccinationSchema.index({ petId: 1, dateAdministered: -1 });

export default mongoose.model<IVaccination>('Vaccination', VaccinationSchema);
