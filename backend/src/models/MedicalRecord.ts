import mongoose, { Schema, Document } from 'mongoose';

interface IVitalEntry {
  value: number | string;
  notes: string;
}

export interface IMedicalRecord extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
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
  overallObservation: string;
  sharedWithOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VitalEntrySchema = new Schema(
  {
    value: {
      type: Schema.Types.Mixed,
      required: [true, 'Value is required']
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
    vitals: {
      weight: { type: VitalEntrySchema, required: true },
      temperature: { type: VitalEntrySchema, required: true },
      pulseRate: { type: VitalEntrySchema, required: true },
      spo2: { type: VitalEntrySchema, required: true },
      bodyConditionScore: { type: VitalEntrySchema, required: true },
      dentalScore: { type: VitalEntrySchema, required: true },
      crt: { type: VitalEntrySchema, required: true },
      pregnancy: { type: VitalEntrySchema, required: true },
      xray: { type: VitalEntrySchema, required: true },
      vaccinated: { type: VitalEntrySchema, required: true }
    },
    images: [ImageFragmentSchema],
    overallObservation: {
      type: String,
      default: ''
    },
    sharedWithOwner: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Index for quick lookup by pet + date
MedicalRecordSchema.index({ petId: 1, createdAt: -1 });

export default mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);
