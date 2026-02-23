import { authenticatedFetch } from './auth';

export interface VitalEntry {
  value: number | string;
  notes: string;
}

export interface Vitals {
  weight: VitalEntry;
  temperature: VitalEntry;
  pulseRate: VitalEntry;
  spo2: VitalEntry;
  bodyConditionScore: VitalEntry;
  dentalScore: VitalEntry;
  crt: VitalEntry;
  pregnancy: VitalEntry;
  xray: VitalEntry;
  vaccinated: VitalEntry;
}

export interface ImageFragment {
  _id?: string;
  data?: string; // base64
  contentType: string;
  description: string;
}

export interface MedicalRecord {
  _id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  petId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vetId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clinicId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clinicBranchId: any;
  vitals: Vitals;
  images: ImageFragment[];
  visitSummary: string;
  vetNotes?: string;
  overallObservation: string;
  sharedWithOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vaccination {
  _id: string;
  petId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vetId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clinicId: any;
  clinicBranchId: string | null;
  vaccineName: string;
  dateAdministered: string;
  nextDueDate: string | null;
  isUpToDate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaccinationsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { vaccinations: Vaccination[] };
}

export interface MedicalRecordResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { record: MedicalRecord };
}

export interface MedicalRecordsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { records: MedicalRecord[] };
}

/**
 * Create a new medical record
 */
export const createMedicalRecord = async (recordData: {
  petId: string;
  clinicId: string;
  clinicBranchId: string;
  vitals: Vitals;
  images?: { data: string; contentType: string; description?: string }[];
  overallObservation?: string;
}, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch('/medical-records', {
    method: 'POST',
    body: JSON.stringify(recordData)
  }, token);
};

/**
 * Get all medical records for a pet
 */
export const getRecordsByPet = async (petId: string, token?: string): Promise<MedicalRecordsResponse> => {
  return authenticatedFetch(`/medical-records/pet/${petId}`, { method: 'GET' }, token);
};

/**
 * Get a single medical record (full report)
 */
export const getRecordById = async (id: string, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch(`/medical-records/${id}`, { method: 'GET' }, token);
};

/**
 * Update a medical record
 */
export const updateMedicalRecord = async (id: string, updates: Partial<{
  vitals: Vitals;
  images: { data: string; contentType: string; description?: string }[];
  overallObservation: string;
}>, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch(`/medical-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }, token);
};

/**
 * Delete a medical record
 */
export const deleteMedicalRecord = async (id: string, token?: string): Promise<{ status: string; message: string }> => {
  return authenticatedFetch(`/medical-records/${id}`, { method: 'DELETE' }, token);
};

/**
 * Toggle sharing a record with the pet owner
 */
export const toggleShareRecord = async (id: string, shared: boolean, token?: string): Promise<{ status: string; message?: string; data?: { sharedWithOwner: boolean } }> => {
  return authenticatedFetch(`/medical-records/${id}/share`, {
    method: 'PATCH',
    body: JSON.stringify({ shared })
  }, token);
};

/**
 * Get all vaccinations for a pet
 */
export const getVaccinationsByPet = async (petId: string, token?: string): Promise<VaccinationsResponse> => {
  return authenticatedFetch(`/medical-records/pet/${petId}/vaccinations`, { method: 'GET' }, token);
};
