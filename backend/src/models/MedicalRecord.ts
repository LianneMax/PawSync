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
  quantity?: number | null;
  pricingType?: 'singlePill' | 'pack' | '';
  piecesPerPack?: number | null;
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
  notes: string;
}

export interface IPregnancyRecord {
  isPregnant: boolean;
  gestationDate: Date | null;
  expectedDueDate: Date | null;
  litterNumber: number | null;
  confirmationMethod: 'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown';
  confirmationSource: 'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  confirmedAt: Date | null;
  notes: string;
}

export interface IPregnancyDelivery {
  deliveryDate: Date | null;
  deliveryType: string;
  laborDuration: string;
  liveBirths: number;
  stillBirths: number;
  motherCondition: 'stable' | 'critical' | 'recovering';
  vetRemarks: string;
  deliveryLocation: 'in_clinic' | 'outside_clinic' | 'unknown';
  reportedBy: 'vet' | 'owner' | 'external_vet' | 'unknown';
}

export interface IPregnancyLoss {
  lossDate: Date | null;
  lossType: 'miscarriage' | 'reabsorption' | 'abortion' | 'other';
  gestationalAgeAtLoss: number | null;
  notes: string;
  reportedBy: 'vet' | 'owner' | 'external_vet' | 'unknown';
}

export interface ISurgeryRecord {
  surgeryType: string;
  vetRemarks: string;
}

export interface IFollowUp {
  _id: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  ownerObservations: string;
  vetNotes: string;
  sharedWithOwner: boolean;
  media: { data: Buffer; contentType: string; description: string }[];
  createdAt: Date;
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
  confinementAction: 'none' | 'confined' | 'released';
  confinementDays: number;
  referral: boolean;
  discharge: boolean;
  scheduledSurgery: boolean;
  pregnancyRecord?: IPregnancyRecord | null;
  pregnancyDelivery?: IPregnancyDelivery | null;
  pregnancyLoss?: IPregnancyLoss | null;
  surgeryRecord?: ISurgeryRecord | null;
  billingId: mongoose.Types.ObjectId | null;
  followUps: IFollowUp[];
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
    status: { type: String, enum: ['active', 'completed', 'discontinued'], default: 'active' },
    quantity: { type: Number, default: null },
    pricingType: { type: String, enum: ['singlePill', 'pack', ''], default: '' },
    piecesPerPack: { type: Number, default: null },
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
    notes: { type: String, default: '' }
  },
  { _id: true }
);

const PregnancyRecordSchema = new Schema(
  {
    isPregnant: { type: Boolean, default: false },
    gestationDate: { type: Date, default: null },
    expectedDueDate: { type: Date, default: null },
    litterNumber: { type: Number, default: null },
    confirmationMethod: {
      type: String,
      enum: ['ultrasound', 'abdominal_palpation', 'clinical_observation', 'external_documentation', 'unknown'],
      default: 'unknown',
    },
    confirmationSource: {
      type: String,
      enum: ['this_clinic', 'external_clinic', 'owner_reported', 'inferred', 'unknown'],
      default: 'unknown',
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    confirmedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const PregnancyDeliverySchema = new Schema(
  {
    deliveryDate: { type: Date, default: null },
    deliveryType: { type: String, default: '' },
    laborDuration: { type: String, default: '' },
    liveBirths: { type: Number, default: 0 },
    stillBirths: { type: Number, default: 0 },
    motherCondition: { type: String, enum: ['stable', 'critical', 'recovering'], default: 'stable' },
    vetRemarks: { type: String, default: '' },
    deliveryLocation: { type: String, enum: ['in_clinic', 'outside_clinic', 'unknown'], default: 'in_clinic' },
    reportedBy: { type: String, enum: ['vet', 'owner', 'external_vet', 'unknown'], default: 'vet' },
  },
  { _id: false }
);

const PregnancyLossSchema = new Schema(
  {
    lossDate: { type: Date, default: null },
    lossType: { type: String, enum: ['miscarriage', 'reabsorption', 'abortion', 'other'], default: 'miscarriage' },
    gestationalAgeAtLoss: { type: Number, default: null },
    notes: { type: String, default: '' },
    reportedBy: { type: String, enum: ['vet', 'owner', 'external_vet', 'unknown'], default: 'vet' },
  },
  { _id: false }
);

const SurgeryRecordSchema = new Schema(
  {
    surgeryType: { type: String, default: '' },
    vetRemarks: { type: String, default: '' },
  },
  { _id: false }
);

const FollowUpSchema = new Schema(
  {
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    ownerObservations: {
      type: String,
      default: ''
    },
    vetNotes: {
      type: String,
      default: ''
    },
    sharedWithOwner: {
      type: Boolean,
      default: false
    },
    media: [ImageFragmentSchema]
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
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
    confinementAction: {
      type: String,
      enum: ['none', 'confined', 'released'],
      default: 'none'
    },
    confinementDays: {
      type: Number,
      default: 0
    },
    referral: {
      type: Boolean,
      default: false
    },
    discharge: {
      type: Boolean,
      default: false
    },
    scheduledSurgery: {
      type: Boolean,
      default: false
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true
    },
    pregnancyRecord: {
      type: PregnancyRecordSchema,
      default: null,
    },
    pregnancyDelivery: {
      type: PregnancyDeliverySchema,
      default: null,
    },
    pregnancyLoss: {
      type: PregnancyLossSchema,
      default: null,
    },
    surgeryRecord: {
      type: SurgeryRecordSchema,
      default: null,
    },
    billingId: {
      type: Schema.Types.ObjectId,
      ref: 'Billing',
      default: null,
    },
    followUps: {
      type: [FollowUpSchema],
      default: []
    },
  },
  {
    timestamps: true
  }
);

// Index for quick lookup by pet + date + current status
MedicalRecordSchema.index({ petId: 1, createdAt: -1 });
MedicalRecordSchema.index({ petId: 1, isCurrent: 1 });

// Validate score ranges before saving
MedicalRecordSchema.pre('validate', function() {
  const bcs = this.vitals?.bodyConditionScore?.value;
  if (bcs !== '' && bcs !== null && bcs !== undefined) {
    const num = Number(bcs);
    if (!isNaN(num) && (num < 1 || num > 5)) {
      this.invalidate('vitals.bodyConditionScore.value', 'Body Condition Score must be between 1 and 5');
    }
  }
  const ds = this.vitals?.dentalScore?.value;
  if (ds !== '' && ds !== null && ds !== undefined) {
    const num = Number(ds);
    if (!isNaN(num) && (num < 1 || num > 3)) {
      this.invalidate('vitals.dentalScore.value', 'Dental Score must be between 1 and 3');
    }
  }
});

export default mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);
