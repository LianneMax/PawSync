import { authenticatedFetch } from '@/lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReportType =
  | 'general'
  | 'soap'
  | 'diagnostic'
  | 'surgery'
  | 'healthCertificate'
  | 'dischargeSummary'
  | 'referralLetter'
  | 'confinement';

export interface ReportTypeConfig {
  value: ReportType;
  label: string;
  description: string;
}

export const REPORT_TYPE_CONFIG: ReportTypeConfig[] = [
  {
    value: 'general',
    label: 'General Report',
    description: 'Full diagnostic write-up: clinical summary, lab interpretation, assessment, and management plan.',
  },
  {
    value: 'soap',
    label: 'SOAP Notes',
    description: 'Per-visit progress note covering Subjective, Objective, Assessment, and Plan (single visit only).',
  },
  {
    value: 'diagnostic',
    label: 'Diagnostic Report',
    description: 'Technical write-up from diagnostic tests: blood work, urinalysis, X-rays, and more.',
  },
  {
    value: 'surgery',
    label: 'Surgery / Anesthesia Report',
    description: 'Operative log with pre-op summary, surgical steps, intraoperative monitoring, and post-op care.',
  },
  {
    value: 'healthCertificate',
    label: 'Health Certificate',
    description: 'Official document certifying pet health status, vaccinations, and parasite control for travel.',
  },
  {
    value: 'dischargeSummary',
    label: 'Discharge Summary',
    description: 'Owner-facing instructions for medications, feeding, activity restrictions, and follow-up care.',
  },
  {
    value: 'referralLetter',
    label: 'Referral Letter',
    description: 'Professional letter summarizing history, findings, and consultation request for a specialist.',
  },
  {
    value: 'confinement',
    label: 'Confinement Report',
    description: 'Admission summary, day-by-day monitoring log, treatments given, and current status for an inpatient stay.',
  },
];

export const SECTION_LABELS_BY_TYPE: Record<ReportType, Record<string, string>> = {
  general: {
    clinicalSummary: 'I. Clinical Summary',
    laboratoryInterpretation: 'II. Laboratory Interpretation',
    diagnosticIntegration: 'III. Overall Diagnostic Integration',
    assessment: 'IV. Assessment',
    managementPlan: 'V. Recommendations and Management Plan',
    prognosis: 'VI. Prognosis',
  },
  soap: {
    subjective: 'S: Subjective (Owner\'s Report & History)',
    objective: 'O: Objective (Physical Examination & Vitals)',
    assessment: 'A: Assessment (Clinical Diagnosis)',
    plan: 'P: Plan (Treatment & Next Steps)',
  },
  diagnostic: {
    testsSummary: 'I. Tests Performed',
    resultsInterpretation: 'II. Results Interpretation',
    clinicalCorrelation: 'III. Clinical Correlation',
    recommendations: 'IV. Recommendations',
  },
  surgery: {
    preoperativeSummary: 'I. Pre-operative Summary',
    surgicalProcedure: 'II. Surgical Procedure',
    intraoperativeMonitoring: 'III. Intraoperative Monitoring',
    postoperativeCare: 'IV. Post-operative Care',
    complications: 'V. Complications & Remarks',
  },
  healthCertificate: {
    patientHealthStatus: 'I. Current Health Status',
    vaccinationHistory: 'II. Vaccination & Immunization History',
    parasiteControl: 'III. Parasite Control',
    travelClearance: 'IV. Veterinary Clearance',
  },
  dischargeSummary: {
    diagnosisSummary: 'I. Diagnosis Summary',
    medications: 'II. Medications',
    feedingInstructions: 'III. Feeding Instructions',
    activityRestrictions: 'IV. Activity & Rest Instructions',
    followUpCare: 'V. Follow-up Care',
    warningSignsToWatch: 'VI. Warning Signs to Watch',
  },
  referralLetter: {
    referralReason: 'I. Reason for Referral',
    clinicalHistory: 'II. Clinical History',
    currentFindings: 'III. Current Findings',
    treatmentsToDate: 'IV. Treatments to Date',
    referralRequest: 'V. Specialist Consultation Request',
  },
  confinement: {
    admissionSummary: 'I. Admission Summary',
    monitoringTimeline: 'II. Monitoring Timeline',
    treatmentsGiven: 'III. Treatments Given',
    currentStatus: 'IV. Current Status',
    recommendations: 'V. Recommendations',
  },
};

export const REPORT_TYPE_DOCUMENT_TITLES: Record<ReportType, string> = {
  general: 'Veterinary Diagnostic Report',
  soap: 'SOAP Progress Note',
  diagnostic: 'Diagnostic Test Report',
  surgery: 'Surgical & Anesthesia Report',
  healthCertificate: 'Veterinary Health Certificate',
  dischargeSummary: 'Discharge Summary',
  referralLetter: 'Veterinary Referral Letter',
  confinement: 'Confinement Report',
};

export type VetReportSections = Record<string, string>;

/**
 * One row of the owner-summary treatment timeline. Clinical fields mirror the linked
 * medical record's medication; only `whatItDoes` is the AI blurb the vet may edit.
 * Dates are ISO strings over the wire.
 */
export interface TreatmentItem {
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  startDate: string | null;
  endDate: string | null;
  visitDate: string | null;
  status: string;
  whatItDoes: string;
}

export interface OwnerSummary {
  whatWeFound: string;
  testResultsExplained: string;
  whatsHappeningInTheirBody: string;
  theDiagnosis: string;
  theTreatmentPlan: string;
  whatToExpect: string;
  treatmentPlan?: TreatmentItem[];
}

export interface LinkedRecord {
  _id: string;
  chiefComplaint?: string;
  createdAt?: string;
  updatedAt?: string;
  stage?: string;
  vitals?: Record<string, { value: string | number; notes?: string }>;
  diagnosticTests?: Array<{
    testType: string;
    name: string;
    result?: string;
    normalRange?: string;
    notes?: string;
    images?: Array<{ url: string; description?: string }>;
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
    route: string;
    frequency: string;
    duration: string;
    status: string;
    notes?: string;
  }>;
  preventiveCare?: Array<{
    careType: string;
    product: string;
    dateAdministered?: string;
    notes?: string;
  }>;
  surgeryRecord?: {
    surgeryType?: string;
    vetRemarks?: string;
    images?: Array<{ url: string; description?: string }>;
  };
  immunityTesting?: {
    enabled?: boolean;
    kitName?: string;
    testDate?: string;
    rows?: Array<{ disease: string; score: number | null; status: string; action: string }>;
    antigenEnabled?: boolean;
    antigenRows?: Array<{ disease: string; result: string }>;
    antigenDate?: string;
  };
  overallObservation?: string;
  assessment?: string;
}

export interface MonitoringMetric {
  value: number;
  unit: string;
}

export interface MonitoringEntry {
  _id: string;
  recordedAt: string;
  entryType: 'daily' | 'spot';
  temperature: MonitoringMetric;
  heartRate: MonitoringMetric;
  respiratoryRate?: MonitoringMetric | null;
  weight: MonitoringMetric;
  bodyConditionScore?: MonitoringMetric | null;
  spo2?: MonitoringMetric | null;
  bloodGlucose?: MonitoringMetric | null;
  painScore?: number | null;
  hydrationStatus?: string;
  appetite?: string;
  clinicalNotes: string;
  clinicalFlag: 'normal' | 'abnormal' | 'critical';
  followUpAction: string;
  followUpInHours?: number | null;
  requiresImmediateReview: boolean;
}

export interface VaccinationRecord {
  _id: string;
  vaccineName: string;
  dateAdministered?: string;
  nextDueDate?: string;
  doseNumber: number;
  boosterNumber: number;
  status: string;
  manufacturer?: string;
  notes?: string;
}

export interface ReportAddendum {
  _id: string;
  text: string;
  addedBy: { _id: string; firstName: string; lastName: string } | string;
  addedAt: string;
}

export interface VetReport {
  _id: string;
  petId: {
    _id: string;
    name: string;
    species: string;
    breed: string;
    photo?: string;
    sex?: string;
    dateOfBirth?: string;
    weight?: number;
    allergies?: string[];
    sterilization?: string;
    microchipNumber?: string | null;
    /** Populated in listVetReports so the reports list can show/search the owner */
    ownerId?: { _id: string; firstName: string; lastName: string } | string | null;
  };
  medicalRecordId?: string | null;
  medicalRecordIds?: (string | LinkedRecord)[];
  confinementRecordId?: string | { _id: string; reason: string; notes?: string; admissionDate: string; dischargeDate?: string | null; status: 'admitted' | 'discharged' } | null;
  scope?: 'selected' | 'all';
  recordsSyncedAt?: string | null;
  newRecordCount?: number;
  updatedSourceCount?: number;
  reportType: ReportType;
  vetId: {
    _id: string;
    firstName: string;
    lastName: string;
    prcLicenseNumber?: string;
  };
  clinicId: string;
  clinicBranchId: string;
  title: string;
  reportDate: string;
  vetContextNotes: string;
  sections: VetReportSections;
  ownerSummary?: OwnerSummary | null;
  isAIGenerated: boolean;
  status: 'draft' | 'finalized';
  sharedWithOwner: boolean;
  sharedAt?: string | null;
  vetSignature?: { url: string | null; signedAt: string | null } | null;
  addenda: ReportAddendum[];
  vaccinations?: VaccinationRecord[];
  /** Only populated for reportType === 'confinement'; the stay's monitoring log, oldest first. */
  monitoringEntries?: MonitoringEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVetReportInput {
  petId: string;
  reportType?: ReportType;
  medicalRecordId?: string;
  medicalRecordIds?: string[];
  /** Required when reportType === 'confinement'; the report's record set is derived from this stay. */
  confinementRecordId?: string;
  scope?: 'selected' | 'all';
  title?: string;
  reportDate?: string;
  vetContextNotes?: string;
}

export interface UpdateVetReportInput {
  title?: string;
  reportDate?: string;
  vetContextNotes?: string;
  sections?: VetReportSections;
  status?: 'draft' | 'finalized';
  vetSignature?: { url: string; signedAt: string };
}

// ─── Legacy exports (general type aliases) ───────────────────────────────────

export const SECTION_LABELS = SECTION_LABELS_BY_TYPE.general;
export const SECTION_KEYS = Object.keys(SECTION_LABELS_BY_TYPE.general);

/** The six plain-text summary sections (excludes the structured `treatmentPlan` array). */
export type OwnerSummaryTextKey =
  | 'whatWeFound'
  | 'testResultsExplained'
  | 'whatsHappeningInTheirBody'
  | 'theDiagnosis'
  | 'theTreatmentPlan'
  | 'whatToExpect';

// Order = the pet owner's reading flow: what happened, the evidence, the answer,
// then the biology, the plan, and the outlook.
export const OWNER_SUMMARY_LABELS: Record<OwnerSummaryTextKey, string> = {
  whatWeFound: 'What We Found',
  testResultsExplained: 'Test Results Explained',
  theDiagnosis: 'The Diagnosis',
  whatsHappeningInTheirBody: "What's Happening in Their Body",
  theTreatmentPlan: 'The Treatment Plan',
  whatToExpect: 'What to Expect',
};

export const OWNER_SUMMARY_KEYS = Object.keys(OWNER_SUMMARY_LABELS) as OwnerSummaryTextKey[];

// ─── API Helpers ─────────────────────────────────────────────────────────────

export async function listSharedReportsForOwner(
  petId: string,
  token?: string
): Promise<VetReport[]> {
  const json = await authenticatedFetch(
    `/vet-reports/for-owner/pet/${petId}`,
    { method: 'GET' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to fetch reports');
  return json.data;
}

/** List filter for report lifecycle state; shared wins over draft/finalized, matching the badge. */
export type ReportStatusFilter = 'draft' | 'finalized' | 'shared';

export async function listVetReports(
  params?: {
    petId?: string;
    limit?: number;
    offset?: number;
    /** Free-text search across report title, pet name, and owner name */
    search?: string;
    /** Multi-select report type filter */
    types?: ReportType[];
    /** Single-select status filter */
    status?: ReportStatusFilter;
  },
  token?: string
): Promise<{ data: VetReport[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.petId) qs.set('petId', params.petId);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.types?.length) qs.set('types', params.types.join(','));
  if (params?.status) qs.set('status', params.status);

  const json = await authenticatedFetch(
    `/vet-reports${qs.toString() ? `?${qs}` : ''}`,
    { method: 'GET' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to fetch reports');
  return json;
}

export class DuplicateReportError extends Error {
  existingReportId: string;
  constructor(existingReportId: string) {
    super('A report already exists for this medical record.');
    this.existingReportId = existingReportId;
  }
}

export async function createVetReport(
  input: CreateVetReportInput,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    '/vet-reports',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    token
  );
  if (json?.existingReportId) throw new DuplicateReportError(json.existingReportId);
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to create report');
  return json.data;
}

export async function getVetReport(id: string, token?: string): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}`,
    { method: 'GET' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to fetch report');
  return json.data;
}

export async function getSharedReport(id: string): Promise<VetReport> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  const res = await fetch(`${API_BASE_URL}/vet-reports/shared/${id}`, { cache: 'no-store' });
  const json = await res.json();
  if (json?.status !== 'OK') throw new Error(json?.message || 'Report not found or not shared');
  return json.data;
}

export async function updateVetReport(
  id: string,
  input: UpdateVetReportInput,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to update report');
  return json.data;
}

/** Drafts only — the backend rejects deletion of finalized or shared reports. */
export async function deleteVetReport(id: string, token?: string): Promise<void> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}`,
    { method: 'DELETE' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to delete report');
}

export async function generateVetReport(id: string, token?: string): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/generate`,
    { method: 'POST' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'AI generation failed');
  return json.data;
}

export async function humanizeVetReport(id: string, token?: string): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/humanize`,
    { method: 'POST' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Humanization failed');
  return json.data;
}

/** Owner summaries stay editable after finalization (unlike sections); a summary must exist first. */
export async function updateVetReportOwnerSummary(
  id: string,
  ownerSummary: Partial<OwnerSummary>,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/owner-summary`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerSummary }),
    },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to save owner summary');
  return json.data;
}

export async function syncVetReportRecords(
  id: string,
  token?: string,
  addRecordIds?: string[]
): Promise<{ report: VetReport; addedCount: number }> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/sync-records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addRecordIds?.length ? { addRecordIds } : { addNew: true }),
    },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to sync records');
  return { report: json.data, addedCount: json.addedCount ?? 0 };
}

export async function shareVetReport(
  id: string,
  shared: boolean,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/share`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shared }),
    },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to update share status');
  return json.data;
}

export async function addVetReportAddendum(
  id: string,
  text: string,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/addenda`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to add addendum');
  return json.data;
}

export async function draftVetReportAddendum(
  id: string,
  token?: string
): Promise<{ text: string; newRecordCount?: number; updatedSourceCount?: number }> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/addenda/draft`,
    { method: 'POST' },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to draft addendum');
  return json.data;
}

export async function validateVetReportAddendum(
  id: string,
  text: string,
  token?: string
): Promise<{ valid: boolean; confidence: string; issues: string[]; suggestedRevision: string; summary: string }> {
  const json = await authenticatedFetch(
    `/vet-reports/${id}/addenda/validate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    token
  );
  if (json?.status !== 'OK') throw new Error(json?.message || 'Failed to validate addendum');
  return json.data;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatReportDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getSectionLabels(reportType?: ReportType | null): Record<string, string> {
  return SECTION_LABELS_BY_TYPE[reportType ?? 'general'] ?? SECTION_LABELS_BY_TYPE.general;
}

export function getSectionKeys(reportType?: ReportType | null): string[] {
  return Object.keys(getSectionLabels(reportType));
}
