import mongoose, { Schema, Document } from 'mongoose';

export type MonitoringEntryType = 'daily' | 'spot';
export type MonitoringFlag = 'normal' | 'abnormal' | 'critical';
export type FollowUpAction = 'watch' | 'recheck' | 'escalate' | 'medication_adjustment' | 'diagnostics';

export interface INumericMetric {
  value: number;
  unit: string;
}

export interface IConfinementMonitoringEntry extends Document {
  confinementRecordId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  medicalRecordId: mongoose.Types.ObjectId | null;
  recordedAt: Date;
  entryType: MonitoringEntryType;
  recorderId: mongoose.Types.ObjectId;
  recorderRole: 'veterinarian' | 'clinic-admin';
  temperature: INumericMetric;
  heartRate: INumericMetric;
  respiratoryRate: INumericMetric;
  weight: INumericMetric;
  hydrationStatus: string;
  appetite: string;
  painScore: number;
  capillaryRefillTime: INumericMetric | null;
  spo2: INumericMetric | null;
  bloodGlucose: INumericMetric | null;
  bloodPressureSystolic: INumericMetric | null;
  bloodPressureDiastolic: INumericMetric | null;
  clinicalNotes: string;
  clinicalFlag: MonitoringFlag;
  followUpAction: FollowUpAction;
  followUpInHours: number | null;
  requiresImmediateReview: boolean;
  alertResolved: boolean;
  alertResolvedAt: Date | null;
  alertResolvedBy: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  editReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const numericMetricSchema = new Schema<INumericMetric>(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const optionalNumericMetricSchema = new Schema<INumericMetric>(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ConfinementMonitoringEntrySchema = new Schema<IConfinementMonitoringEntry>(
  {
    confinementRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'ConfinementRecord',
      required: true,
      index: true,
    },
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      default: null,
    },
    recordedAt: {
      type: Date,
      required: true,
      index: true,
      default: Date.now,
    },
    entryType: {
      type: String,
      enum: ['daily', 'spot'],
      required: true,
      index: true,
    },
    recorderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recorderRole: {
      type: String,
      enum: ['veterinarian', 'clinic-admin'],
      required: true,
    },
    temperature: {
      type: numericMetricSchema,
      required: true,
    },
    heartRate: {
      type: numericMetricSchema,
      required: true,
    },
    respiratoryRate: {
      type: numericMetricSchema,
      required: true,
    },
    weight: {
      type: numericMetricSchema,
      required: true,
    },
    hydrationStatus: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    appetite: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    painScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    capillaryRefillTime: {
      type: optionalNumericMetricSchema,
      default: null,
    },
    spo2: {
      type: optionalNumericMetricSchema,
      default: null,
    },
    bloodGlucose: {
      type: optionalNumericMetricSchema,
      default: null,
    },
    bloodPressureSystolic: {
      type: optionalNumericMetricSchema,
      default: null,
    },
    bloodPressureDiastolic: {
      type: optionalNumericMetricSchema,
      default: null,
    },
    clinicalNotes: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    clinicalFlag: {
      type: String,
      enum: ['normal', 'abnormal', 'critical'],
      default: 'normal',
      index: true,
    },
    followUpAction: {
      type: String,
      enum: ['watch', 'recheck', 'escalate', 'medication_adjustment', 'diagnostics'],
      required: true,
    },
    followUpInHours: {
      type: Number,
      default: null,
      min: 1,
      max: 168,
    },
    requiresImmediateReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    alertResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    alertResolvedAt: {
      type: Date,
      default: null,
    },
    alertResolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    editReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true },
);

ConfinementMonitoringEntrySchema.index({ confinementRecordId: 1, recordedAt: -1 });

ConfinementMonitoringEntrySchema.pre('validate', function () {
  const doc = this as IConfinementMonitoringEntry;

  const requireReasonForOutOfRange = (isOutOfRange: boolean, label: string) => {
    if (!isOutOfRange) return;
    if (!doc.editReason || !doc.editReason.trim()) {
      (doc as any).invalidate('editReason', `${label} is outside expected range. Provide an override reason in editReason.`);
    }
  };

  const temp = doc.temperature?.value;
  const hr = doc.heartRate?.value;
  const rr = doc.respiratoryRate?.value;
  const wt = doc.weight?.value;
  const spo2 = doc.spo2?.value;

  requireReasonForOutOfRange(temp < 34 || temp > 42, 'Temperature');
  requireReasonForOutOfRange(hr < 40 || hr > 260, 'Heart rate');
  requireReasonForOutOfRange(rr < 5 || rr > 120, 'Respiratory rate');
  requireReasonForOutOfRange(wt <= 0 || wt > 200, 'Weight');
  if (typeof spo2 === 'number') {
    requireReasonForOutOfRange(spo2 < 50 || spo2 > 100, 'SpO2');
  }

  if (doc.clinicalFlag === 'critical' && (!doc.clinicalNotes || !doc.clinicalNotes.trim())) {
    (doc as any).invalidate('clinicalNotes', 'Clinical notes are required for critical entries.');
  }

  if (doc.followUpAction === 'recheck' && !doc.followUpInHours) {
    (doc as any).invalidate('followUpInHours', 'followUpInHours is required when followUpAction is recheck.');
  }

});

export default mongoose.model<IConfinementMonitoringEntry>(
  'ConfinementMonitoringEntry',
  ConfinementMonitoringEntrySchema,
);
