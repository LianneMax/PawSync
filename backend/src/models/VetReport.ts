import mongoose, { Schema, Document } from 'mongoose';

export interface IVetReportSections {
  clinicalSummary: string;
  laboratoryInterpretation: string;
  diagnosticIntegration: string;
  assessment: string;
  managementPlan: string;
  prognosis: string;
}

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
  medicalRecordId?: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  title: string;
  reportDate: Date;
  /** Free-form context the vet types before hitting Generate */
  vetContextNotes: string;
  sections: IVetReportSections;
  ownerSummary?: IOwnerSummary | null;
  isAIGenerated: boolean;
  status: 'draft' | 'finalized';
  sharedWithOwner: boolean;
  sharedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VetReportSectionsSchema = new Schema<IVetReportSections>(
  {
    clinicalSummary: { type: String, default: '' },
    laboratoryInterpretation: { type: String, default: '' },
    diagnosticIntegration: { type: String, default: '' },
    assessment: { type: String, default: '' },
    managementPlan: { type: String, default: '' },
    prognosis: { type: String, default: '' },
  },
  { _id: false }
);

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
    vetId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    clinicBranchId: { type: Schema.Types.ObjectId, ref: 'ClinicBranch', required: true },
    title: { type: String, default: '' },
    reportDate: { type: Date, default: Date.now },
    vetContextNotes: { type: String, default: '' },
    sections: { type: VetReportSectionsSchema, default: () => ({}) },
    ownerSummary: { type: OwnerSummarySchema, default: null },
    isAIGenerated: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
    sharedWithOwner: { type: Boolean, default: false },
    sharedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

VetReportSchema.index({ vetId: 1, createdAt: -1 });
VetReportSchema.index({ petId: 1, createdAt: -1 });
VetReportSchema.index({ clinicId: 1, createdAt: -1 });

export default mongoose.model<IVetReport>('VetReport', VetReportSchema);
