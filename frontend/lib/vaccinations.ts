const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export interface VaccineType {
  _id: string;
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;
  requiresBooster: boolean;
  boosterIntervalDays: number | null;
  minAgeMonths: number;
  route: string | null;
  isActive: boolean;
}

export interface Vaccination {
  _id: string;
  petId: string | { _id: string; name: string; species: string; breed: string; photo?: string };
  vetId: string | { _id: string; firstName: string; lastName: string };
  clinicId: string | { _id: string; name: string };
  clinicBranchId: string | { _id: string; name: string } | null;
  vaccineTypeId: string | VaccineType | null;
  vaccineName: string;
  manufacturer: string;
  batchNumber: string;
  route: 'subcutaneous' | 'intramuscular' | 'intranasal' | 'oral' | null;
  dateAdministered: string | null;
  expiryDate: string | null;
  nextDueDate: string | null;
  status: 'active' | 'expired' | 'overdue' | 'pending' | 'declined';
  isUpToDate: boolean;
  notes: string;
  declinedReason: string | null;
  createdAt: string;
}

export interface CreateVaccinationInput {
  petId: string;
  vaccineTypeId: string;
  manufacturer?: string;
  batchNumber?: string;
  route?: string;
  dateAdministered?: string;
  notes?: string;
  clinicId?: string;
  clinicBranchId?: string;
  /** Clinic-admin: specify which vet administered the vaccine */
  vetId?: string;
  /** Link to a medical record */
  medicalRecordId?: string;
  /** Link to an appointment */
  appointmentId?: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Get vaccine types for dropdowns. Optionally filter by pet species. */
export async function getVaccineTypes(species?: string): Promise<VaccineType[]> {
  const url = new URL(`${API_BASE_URL}/vaccine-types`);
  if (species) url.searchParams.set('species', species);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccine types');
  return json.data.vaccineTypes;
}

/** Get all vaccinations for a pet (authenticated). */
export async function getVaccinationsByPet(petId: string, token: string): Promise<Vaccination[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/pet/${petId}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccinations');
  return json.data.vaccinations;
}

/** Get vaccinations for a pet without auth (for public/NFC profile). */
export async function getPublicVaccinationsByPet(petId: string): Promise<Vaccination[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/pet/${petId}/public`);
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccinations');
  return json.data.vaccinations;
}

/** Get all vaccinations recorded by the logged-in vet. */
export async function getVetVaccinations(
  token: string,
  params?: { status?: string; petId?: string }
): Promise<Vaccination[]> {
  const url = new URL(`${API_BASE_URL}/vaccinations/vet/my-records`);
  if (params?.status && params.status !== 'all') url.searchParams.set('status', params.status);
  if (params?.petId) url.searchParams.set('petId', params.petId);
  const res = await fetch(url.toString(), { headers: authHeaders(token) });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccinations');
  return json.data.vaccinations;
}

/** Get a single vaccination by ID. */
export async function getVaccinationById(id: string, token: string): Promise<Vaccination> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/${id}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccination');
  return json.data.vaccination;
}

/** Create a new vaccination record (vet only). */
export async function createVaccination(
  data: CreateVaccinationInput,
  token: string
): Promise<Vaccination> {
  const res = await fetch(`${API_BASE_URL}/vaccinations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to create vaccination');
  return json.data.vaccination;
}

/** Update a vaccination record (vet only). */
export async function updateVaccination(
  id: string,
  data: Partial<CreateVaccinationInput>,
  token: string
): Promise<Vaccination> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to update vaccination');
  return json.data.vaccination;
}

/** Mark a vaccination as declined (vet only). */
export async function declineVaccination(
  id: string,
  reason: string,
  token: string
): Promise<Vaccination> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/${id}/decline`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to decline vaccination');
  return json.data.vaccination;
}

/** Helper to get a human-readable label for a vaccination status. */
export function getStatusLabel(status: Vaccination['status']): string {
  const labels: Record<Vaccination['status'], string> = {
    active: 'Active',
    expired: 'Expired',
    overdue: 'Overdue',
    pending: 'Pending',
    declined: 'Declined',
  };
  return labels[status] ?? status;
}

/** Helper to get Tailwind classes for status badge colors. */
export function getStatusClasses(status: Vaccination['status']): string {
  const classes: Record<Vaccination['status'], string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    expired: 'bg-red-100 text-red-700 border-red-200',
    overdue: 'bg-orange-100 text-orange-700 border-orange-200',
    pending: 'bg-blue-100 text-blue-700 border-blue-200',
    declined: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return classes[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}
