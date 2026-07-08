import mongoose, { Schema, Document } from 'mongoose';

export type ReportType = 'general' | 'soap' | 'diagnostic' | 'surgery' | 'healthCertificate' | 'dischargeSummary' | 'referralLetter';

export interface IOwnerSummary {
  whatWeFound: string;
  testResultsExplained: string;
  whatsHappeningInTheirBody: string;
  theDiagnosis: string;
  theTreatmentPlan: string;
  whatToExpect: string;
}

export interface IVetReport extends Document {
  petId: mongoose.Types.ObjectId;
  /** Legacy single-record link. New reports use medicalRecordIds; kept for backward compat. */
  medicalRecordId?: mongoose.Types.ObjectId;
  /** All medical records this report consolidates, in no guaranteed order. */
  medicalRecordIds: mongoose.Types.ObjectId[];
  /** 'all' = report covers every completed record for the pet; 'selected' = vet hand-picked records. */
  scope: 'selected' | 'all';
  /** When the record set was last resolved — used to detect new records since. */
  recordsSyncedAt: Date | null;
  reportType: ReportType;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  title: string;
  reportDate: Date;
  /** Free-form context the vet types before hitting Generate */
  vetContextNotes: string;
  /** Flexible section map — keys depend on reportType */
  sections: Record<string, string>;
  ownerSummary?: IOwnerSummary | null;
  isAIGenerated: boolean;
  status: 'draft' | 'finalized';
  sharedWithOwner: boolean;
  sharedAt?: Date;
  vetSignature?: { url: string | null; signedAt: Date | null };
  createdAt: Date;
  updatedAt: Date;
}

const OwnerSummarySchema = new Schema<IOwnerSummary>(
  {
    whatWeFound: { type: String, default: '' },
    testResultsExplained: { type: String, default: '' },
    whatsHappeningInTheirBody: { type: String, default: '' },
    theDiagnosis: { type: String, default: '' },
    theTreatmentPlan: { type: String, default: '' },
    whatToExpect: { type: String, default: '' },
  },
  { _id: false }
);

const VetReportSchema = new Schema<IVetReport>(
  {
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord', default: null },
    medicalRecordIds: { type: [Schema.Types.ObjectId], ref: 'MedicalRecord', default: [] },
    scope: { type: String, enum: ['selected', 'all'], default: 'selected' },
    recordsSyncedAt: { type: Date, default: null },
    reportType: {
      type: String,
      enum: ['general', 'soap', 'diagnostic', 'surgery', 'healthCertificate', 'dischargeSummary', 'referralLetter'],
      default: 'general',
    },
    vetId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    clinicBranchId: { type: Schema.Types.ObjectId, ref: 'ClinicBranch', required: true },
    title: { type: String, default: '' },
    reportDate: { type: Date, default: Date.now },
    vetContextNotes: { type: String, default: '' },
    sections: { type: Schema.Types.Mixed, default: {} },
    ownerSummary: { type: OwnerSummarySchema, default: null },
    isAIGenerated: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
    sharedWithOwner: { type: Boolean, default: false },
    sharedAt: { type: Date, default: null },
    vetSignature: {
      url: { type: String, default: null },
      signedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

VetReportSchema.index({ vetId: 1, createdAt: -1 });
VetReportSchema.index({ petId: 1, createdAt: -1 });
VetReportSchema.index({ clinicId: 1, createdAt: -1 });
// Enforce one report per medical record at the database level (sparse allows multiple nulls)
VetReportSchema.index({ medicalRecordId: 1 }, { unique: true, sparse: true });

export default mongoose.model<IVetReport>('VetReport', VetReportSchema);
