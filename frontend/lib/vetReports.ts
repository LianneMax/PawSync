import { authenticatedFetch } from '@/lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VetReportSections {
  clinicalSummary: string;
  laboratoryInterpretation: string;
  diagnosticIntegration: string;
  assessment: string;
  managementPlan: string;
  prognosis: string;
}

export interface OwnerSummary {
  whatWeFound: string;
  testResultsExplained: string;
  whatsHappeningInTheirBody: string;
  theDiagnosis: string;
  theTreatmentPlan: string;
  whatToExpect: string;
}

export interface LinkedRecord {
  _id: string;
  chiefComplaint?: string;
  createdAt?: string;
  stage?: string;
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
  };
  medicalRecordId?: string | null;
  /** Consolidated source records; populated with dates on getVetReport/getSharedReport */
  medicalRecordIds?: (string | LinkedRecord)[];
  scope?: 'selected' | 'all';
  recordsSyncedAt?: string | null;
  /** Completed records created since last sync that aren't in the report (getVetReport only) */
  newRecordCount?: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateVetReportInput {
  petId: string;
  medicalRecordId?: string;
  medicalRecordIds?: string[];
  scope?: 'selected' | 'all';
  title?: string;
  reportDate?: string;
  vetContextNotes?: string;
}

export interface UpdateVetReportInput {
  title?: string;
  reportDate?: string;
  vetContextNotes?: string;
  sections?: Partial<VetReportSections>;
  status?: 'draft' | 'finalized';
  vetSignature?: { url: string; signedAt: string };
}

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

export async function listVetReports(
  params?: { petId?: string; limit?: number; offset?: number },
  token?: string
): Promise<{ data: VetReport[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.petId) qs.set('petId', params.petId);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));

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

/**
 * Fold new completed visits into an existing report.
 * Default folds in every new record ('all'-scope re-resolves; 'selected'-scope adds
 * records created since last sync). Pass addRecordIds to add a specific set instead.
 */
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

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatReportDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const OWNER_SUMMARY_LABELS: Record<keyof OwnerSummary, string> = {
  whatWeFound: 'What We Found',
  testResultsExplained: 'Test Results Explained',
  whatsHappeningInTheirBody: "What's Happening in Their Body",
  theDiagnosis: 'The Diagnosis',
  theTreatmentPlan: 'The Treatment Plan',
  whatToExpect: 'What to Expect',
};

export const OWNER_SUMMARY_KEYS = Object.keys(OWNER_SUMMARY_LABELS) as (keyof OwnerSummary)[];

export const SECTION_LABELS: Record<keyof VetReportSections, string> = {
  clinicalSummary: 'I. Clinical Summary',
  laboratoryInterpretation: 'II. Laboratory Interpretation',
  diagnosticIntegration: 'III. Overall Diagnostic Integration',
  assessment: 'IV. Assessment',
  managementPlan: 'V. Recommendations and Management Plan',
  prognosis: 'VI. Prognosis',
};

export const SECTION_KEYS = Object.keys(SECTION_LABELS) as (keyof VetReportSections)[];
