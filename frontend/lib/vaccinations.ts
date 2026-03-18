const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export interface VaccineType {
  _id: string;
  name: string;
  species: ('dog' | 'cat' | 'all')[];
  validityDays: number;
  /** If true, vaccine requires a multi-dose series before protection is complete. */
  isSeries: boolean;
  /** Number of doses in the series (only when isSeries=true). Default 3. */
  totalSeries: number;
  /** Days between each dose in the series. Default 21. */
  seriesIntervalDays: number;
  /** If true, ongoing boosters are required after series completion (or initial single dose). */
  boosterValid: boolean;
  /** Days between booster doses. Default 365. */
  boosterIntervalDays: number | null;
  minAgeMonths: number;
  minAgeUnit: 'weeks' | 'months';
  maxAgeMonths: number | null;
  maxAgeUnit: 'weeks' | 'months';
  route: string | null;
  /** Auto: 0.5 mL for cat/feline, 1.0 mL for dog/canine. */
  doseVolumeMl: number | null;
  defaultManufacturer: string | null;
  defaultBatchNumber: string | null;
  isActive: boolean;
}

export interface Vaccination {
  _id: string;
  petId: string | { _id: string; name: string; species: string; breed: string; photo?: string };
  vetId: string | { _id: string; firstName: string; lastName: string; email?: string; profilePhoto?: string | null };
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
  boosterAppointmentId: string | null;
  appointmentId?: string | null;
  medicalRecordId?: string | null;
  /** Sequential dose number (1 = first/initial, 2 = second, etc.) */
  doseNumber: number;
  /**
   * 0 = still in series (or initial single dose when isSeries=false)
   * 1+ = booster #N
   */
  boosterNumber: number;
  status: 'active' | 'expired' | 'overdue' | 'pending';
  isUpToDate: boolean;
  notes: string;
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
  nextDueDate?: string;
  clinicId?: string;
  clinicBranchId?: string;
  /** Clinic-admin: specify which vet administered the vaccine */
  vetId?: string;
  /** Link to a medical record */
  medicalRecordId?: string;
  /** Link to an appointment */
  appointmentId?: string;
  /** Which dose in the series this is (1 = initial, 2 = first booster, etc.) */
  doseNumber?: number;
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

/** Get all vaccine types including inactive (for admin/vet management views). */
export async function getAllVaccineTypes(token: string): Promise<VaccineType[]> {
  const url = new URL(`${API_BASE_URL}/vaccine-types`);
  url.searchParams.set('includeInactive', 'true');
  const res = await fetch(url.toString(), { headers: authHeaders(token) });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccine types');
  return json.data.vaccineTypes;
}

export interface VaccineTypeInput {
  name: string;
  species: string[];
  validityDays: number;
  isSeries?: boolean;
  totalSeries?: number;
  seriesIntervalDays?: number;
  boosterValid?: boolean;
  boosterIntervalDays?: number | null;
  minAgeMonths?: number;
  minAgeUnit?: 'weeks' | 'months';
  maxAgeMonths?: number | null;
  maxAgeUnit?: 'weeks' | 'months';
  route?: string | null;
  doseVolumeMl?: number | null;
  defaultManufacturer?: string | null;
  defaultBatchNumber?: string | null;
}

/** Create a vaccine type (vet or clinic-admin). */
export async function createVaccineType(data: VaccineTypeInput, token: string): Promise<VaccineType> {
  const res = await fetch(`${API_BASE_URL}/vaccine-types`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to create vaccine type');
  return json.data.vaccineType;
}

/** Delete a vaccine type (vet or clinic-admin). */
export async function deleteVaccineType(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/vaccine-types/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to delete vaccine type');
}

/** Update a vaccine type (vet or clinic-admin). */
export async function updateVaccineType(id: string, data: Partial<VaccineTypeInput> & { isActive?: boolean }, token: string): Promise<VaccineType> {
  const res = await fetch(`${API_BASE_URL}/vaccine-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to update vaccine type');
  return json.data.vaccineType;
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

/** Get vaccinations for a specific medical record. */
export async function getVaccinationsByMedicalRecord(medicalRecordId: string, token: string): Promise<Vaccination[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/medical-record/${medicalRecordId}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vaccinations');
  return json.data.vaccinations || [];
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

export async function getClinicVaccinations(
  token: string,
  params?: { status?: string; petId?: string }
): Promise<Vaccination[]> {
  const url = new URL(`${API_BASE_URL}/vaccinations/clinic/records`);
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

export interface CreateVaccinationResult extends Vaccination {
  /** ISO date string of the auto-scheduled booster appointment, if any. */
  boosterDate?: string;
  /** ID of the auto-created booster appointment, if any. */
  boosterAppointmentId?: string;
}

/** Create a new vaccination record (vet only). */
export async function createVaccination(
  data: CreateVaccinationInput,
  token: string
): Promise<CreateVaccinationResult> {
  const res = await fetch(`${API_BASE_URL}/vaccinations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to create vaccination');
  return { ...json.data.vaccination, boosterDate: json.data.boosterDate, boosterAppointmentId: json.data.boosterAppointmentId };
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

/** Delete a vaccination record (vet or clinic-admin). */
export async function deleteVaccination(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to delete vaccination');
}


/** Helper to get a human-readable label for a vaccination status. */
export function getStatusLabel(status: Vaccination['status']): string {
  const labels: Record<Vaccination['status'], string> = {
    active: 'Active',
    expired: 'Expired',
    overdue: 'Overdue',
    pending: 'Pending',
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
  };
  return classes[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming Vaccine Schedule APIs
// ─────────────────────────────────────────────────────────────────────────────

export interface UpcomingVaccine {
  _id: string;
  petId: string;
  vaccineName: string;
  nextDueDate: string; // ISO date string - either booster due or expiry date
  expiryDate: string | null; // Actual expiry date
  lastAdministeredDate: string | null;
  status: string;
  doseNumber: number;
  dateType: 'booster_due' | 'expires'; // What the nextDueDate represents
  vaccineType: {
    _id: string;
    name: string;
    isSeries: boolean;
    totalSeries: number;
    seriesIntervalDays: number;
    boosterValid: boolean;
    boosterIntervalDays: number | null;
  } | null;
}

export interface VetUpcomingSchedule {
  _id: string;
  pet: {
    _id: string;
    name: string;
    species: string;
    breed: string;
    photo?: string;
    ownerId: string;
  };
  vaccineName: string;
  nextDueDate: string; // Either booster due or expiry date
  expiryDate: string | null; // Actual expiry date
  lastAdministeredDate: string | null;
  status: string;
  doseNumber: number;
  dateType: 'booster_due' | 'expires';
  vaccineType: {
    _id: string;
    name: string;
    isSeries: boolean;
    totalSeries: number;
    seriesIntervalDays: number;
    boosterValid: boolean;
    boosterIntervalDays: number | null;
  } | null;
  clinic: {
    _id: string;
    name: string;
  } | null;
}

export interface ClinicUpcomingSchedule {
  _id: string;
  pet: {
    _id: string;
    name: string;
    species: string;
    breed: string;
    photo?: string;
    ownerId: string;
  };
  vet: {
    _id: string;
    name: string;
  };
  vaccineName: string;
  nextDueDate: string; // Either booster due or expiry date
  expiryDate: string | null; // Actual expiry date
  lastAdministeredDate: string | null;
  status: string;
  doseNumber: number;
  dateType: 'booster_due' | 'expires';
  vaccineType: {
    _id: string;
    name: string;
    isSeries: boolean;
    totalSeries: number;
    seriesIntervalDays: number;
    boosterValid: boolean;
    boosterIntervalDays: number | null;
  } | null;
}

/** Get upcoming vaccine due dates for a pet. */
export async function getUpcomingVaccineDates(petId: string, token: string): Promise<UpcomingVaccine[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/pet/${petId}/upcoming`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch upcoming vaccines');
  return json.data.upcomingVaccines;
}

/** Get upcoming vaccine schedules for a vet. */
export async function getVetUpcomingSchedule(vetId: string, token: string): Promise<VetUpcomingSchedule[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/vet/${vetId}/upcoming-schedule`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch vet upcoming schedule');
  return json.data.upcomingSchedule;
}

/** Get upcoming vaccine schedules for a clinic (admin only). */
export async function getClinicUpcomingSchedule(clinicId: string, token: string): Promise<ClinicUpcomingSchedule[]> {
  const res = await fetch(`${API_BASE_URL}/vaccinations/clinic/${clinicId}/upcoming-schedule`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to fetch clinic upcoming schedule');
  return json.data.upcomingSchedule;
}
