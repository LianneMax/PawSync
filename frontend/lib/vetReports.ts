import { authenticatedFetch } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VetReportSections {
  clinicalSummary: string;
  laboratoryInterpretation: string;
  diagnosticIntegration: string;
  assessment: string;
  managementPlan: string;
  prognosis: string;
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

  const res = await authenticatedFetch(
    `${API}/api/vet-reports${qs.toString() ? `?${qs}` : ''}`,
    { method: 'GET' },
    token
  );
  if (!res.ok) throw new Error('Failed to fetch reports');
  const json = await res.json();
  return json;
}

export async function createVetReport(
  input: CreateVetReportInput,
  token?: string
): Promise<VetReport> {
  const res = await authenticatedFetch(
    `${API}/api/vet-reports`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create report');
  }
  const json = await res.json();
  return json.data;
}

export async function getVetReport(id: string, token?: string): Promise<VetReport> {
  const res = await authenticatedFetch(
    `${API}/api/vet-reports/${id}`,
    { method: 'GET' },
    token
  );
  if (!res.ok) throw new Error('Failed to fetch report');
  const json = await res.json();
  return json.data;
}

export async function getSharedReport(id: string): Promise<VetReport> {
  const res = await fetch(`${API}/api/vet-reports/shared/${id}`);
  if (!res.ok) throw new Error('Report not found or not shared');
  const json = await res.json();
  return json.data;
}

export async function updateVetReport(
  id: string,
  input: UpdateVetReportInput,
  token?: string
): Promise<VetReport> {
  const res = await authenticatedFetch(
    `${API}/api/vet-reports/${id}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update report');
  }
  const json = await res.json();
  return json.data;
}

export async function generateVetReport(id: string, token?: string): Promise<VetReport> {
  const res = await authenticatedFetch(
    `${API}/api/vet-reports/${id}/generate`,
    { method: 'POST' },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'AI generation failed');
  }
  const json = await res.json();
  return json.data;
}

export async function shareVetReport(
  id: string,
  shared: boolean,
  token?: string
): Promise<VetReport> {
  const res = await authenticatedFetch(
    `${API}/api/vet-reports/${id}/share`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shared }),
    },
    token
  );
  if (!res.ok) throw new Error('Failed to update share status');
  const json = await res.json();
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

export const SECTION_LABELS: Record<keyof VetReportSections, string> = {
  clinicalSummary: 'I. Clinical Summary',
  laboratoryInterpretation: 'II. Laboratory Interpretation',
  diagnosticIntegration: 'III. Overall Diagnostic Integration',
  assessment: 'IV. Assessment',
  managementPlan: 'V. Recommendations and Management Plan',
  prognosis: 'VI. Prognosis',
};

export const SECTION_KEYS = Object.keys(SECTION_LABELS) as (keyof VetReportSections)[];
