import mongoose, { Schema, Document } from 'mongoose';

export interface IVitalEntry {
  value: number | string;
  notes: string;
}

export interface IMedication {
  name: string;
  dosage: string;
  route: 'oral' | 'topical' | 'injection' | 'other';
  frequency: string;
  duration: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string;
  status: 'active' | 'completed' | 'discontinued';
}

export interface IDiagnosticTest {
  testType: 'blood_work' | 'x_ray' | 'ultrasound' | 'urinalysis' | 'ecg' | 'other';
  name: string;
  date: Date | null;
  result: string;
  normalRange: string;
  notes: string;
}

export interface IPreventiveCare {
  careType: 'flea' | 'tick' | 'heartworm' | 'deworming' | 'other';
  product: string;
  dateAdministered: Date | null;
  nextDueDate: Date | null;
  notes: string;
}

export interface IMedicalRecord extends Document {
  petId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId | null;
  stage: 'pre_procedure' | 'in_procedure' | 'post_procedure' | 'completed';
  chiefComplaint: string;
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
  // SOAP notes
  subjective: string;   // S - Patient history / owner complaint
  assessment: string;   // A - Diagnosis / clinical assessment
  plan: string;         // P - Treatment plan / next steps
  medications: IMedication[];
  diagnosticTests: IDiagnosticTest[];
  preventiveCare: IPreventiveCare[];
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

const MedicationSchema = new Schema(
  {
    name: { type: String, default: '' },
    dosage: { type: String, default: '' },
    route: { type: String, enum: ['oral', 'topical', 'injection', 'other'], default: 'oral' },
    frequency: { type: String, default: '' },
    duration: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed', 'discontinued'], default: 'active' }
  },
  { _id: true }
);

const DiagnosticTestSchema = new Schema(
  {
    testType: { type: String, enum: ['blood_work', 'x_ray', 'ultrasound', 'urinalysis', 'ecg', 'other'], default: 'other' },
    name: { type: String, default: '' },
    date: { type: Date, default: null },
    result: { type: String, default: '' },
    normalRange: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  { _id: true }
);

const PreventiveCareSchema = new Schema(
  {
    careType: { type: String, enum: ['flea', 'tick', 'heartworm', 'deworming', 'other'], default: 'other' },
    product: { type: String, default: '' },
    dateAdministered: { type: Date, default: null },
    nextDueDate: { type: Date, default: null },
    notes: { type: String, default: '' }
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
    stage: {
      type: String,
      enum: ['pre_procedure', 'in_procedure', 'post_procedure', 'completed'],
      default: 'pre_procedure'
    },
    chiefComplaint: {
      type: String,
      default: ''
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
    subjective: {
      type: String,
      default: ''
    },
    assessment: {
      type: String,
      default: ''
    },
    plan: {
      type: String,
      default: ''
    },
    medications: [MedicationSchema],
    diagnosticTests: [DiagnosticTestSchema],
    preventiveCare: [PreventiveCareSchema],
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
