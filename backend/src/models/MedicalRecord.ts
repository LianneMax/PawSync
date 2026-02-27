import mongoose, { Schema, Document } from 'mongoose';

export interface IVitalEntry {
  value: number | string;
  notes: string;
}

export interface IMedicalRecord extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId | null;
  vitals: {
    weight: IVitalEntry;
    temperature: IVitalEntry;
    pulseRate: IVitalEntry;
    spo2: IVitalEntry;
    bodyConditionScore: IVitalEntry;
    dentalScore: IVitalEntry;
    crt: IVitalEntry;
    pregnancy: IVitalEntry;
    xray: IVitalEntry;
    vaccinated: IVitalEntry;
  };
  images: {
    data: Buffer;
    contentType: string;
    description: string;
  }[];
  visitSummary: string;
  vetNotes: string;
  overallObservation: string;
  sharedWithOwner: boolean;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emptyVital = () => ({ value: '', notes: '' });

const VitalEntrySchema = new Schema(
  {
    value: {
      type: Schema.Types.Mixed,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const ImageFragmentSchema = new Schema(
  {
    data: {
      type: Buffer,
      required: [true, 'Image data is required']
    },
    contentType: {
      type: String,
      required: [true, 'Content type is required']
    },
    description: {
      type: String,
      default: ''
    }
  },
  { _id: true }
);

const MedicalRecordSchema = new Schema(
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
      required: [true, 'Veterinarian is required'],
      index: true
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required'],
      index: true
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: [true, 'Clinic branch is required']
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true
    },
    vitals: {
      weight: { type: VitalEntrySchema, default: emptyVital },
      temperature: { type: VitalEntrySchema, default: emptyVital },
      pulseRate: { type: VitalEntrySchema, default: emptyVital },
      spo2: { type: VitalEntrySchema, default: emptyVital },
      bodyConditionScore: { type: VitalEntrySchema, default: emptyVital },
      dentalScore: { type: VitalEntrySchema, default: emptyVital },
      crt: { type: VitalEntrySchema, default: emptyVital },
      pregnancy: { type: VitalEntrySchema, default: emptyVital },
      xray: { type: VitalEntrySchema, default: emptyVital },
      vaccinated: { type: VitalEntrySchema, default: emptyVital }
    },
    images: [ImageFragmentSchema],
    visitSummary: {
      type: String,
      default: ''
    },
    vetNotes: {
      type: String,
      default: ''
    },
    overallObservation: {
      type: String,
      default: ''
    },
    sharedWithOwner: {
      type: Boolean,
      default: false
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Index for quick lookup by pet + date + current status
MedicalRecordSchema.index({ petId: 1, createdAt: -1 });
MedicalRecordSchema.index({ petId: 1, isCurrent: 1 });

export default mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);
