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
  };
  medicalRecordId?: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateVetReportInput {
  petId: string;
  medicalRecordId?: string;
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
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

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

export async function createVetReport(
  input: CreateVetReportInput,
  token?: string
): Promise<VetReport> {
  const json = await authenticatedFetch(
    '/vet-reports',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    token
  );
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
  const res = await fetch(`${API_BASE_URL}/vet-reports/shared/${id}`);
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
