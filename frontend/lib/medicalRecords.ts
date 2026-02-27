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

export const emptyVitals = (): Vitals => ({
  weight: { value: '', notes: '' },
  temperature: { value: '', notes: '' },
  pulseRate: { value: '', notes: '' },
  spo2: { value: '', notes: '' },
  bodyConditionScore: { value: '', notes: '' },
  dentalScore: { value: '', notes: '' },
  crt: { value: '', notes: '' },
  pregnancy: { value: '', notes: '' },
  xray: { value: '', notes: '' },
  vaccinated: { value: '', notes: '' },
});

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
  appointmentId?: any;
  vitals: Vitals;
  images: ImageFragment[];
  visitSummary: string;
  vetNotes?: string;
  overallObservation: string;
  sharedWithOwner: boolean;
  isCurrent: boolean;
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
  expiryDate: string | null;
  nextDueDate: string | null;
  status: 'active' | 'expired' | 'overdue' | 'pending' | 'declined';
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

export interface CurrentAndHistoricalRecordsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    currentRecord: MedicalRecord | null;
    historicalRecords: MedicalRecord[];
  };
}

export interface VetMedicalRecordsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { records: MedicalRecord[]; total: number };
}

/**
 * Create a new medical record.
 * Accepts optional appointmentId to pre-fill data from the appointment.
 * Clinic-admins must supply vetId in the body.
 */
export const createMedicalRecord = async (recordData: {
  petId?: string;
  clinicId?: string;
  clinicBranchId?: string;
  vetId?: string;
  appointmentId?: string;
  vitals?: Partial<Vitals>;
  images?: { data: string; contentType: string; description?: string }[];
  overallObservation?: string;
  visitSummary?: string;
  vetNotes?: string;
  sharedWithOwner?: boolean;
}, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch('/medical-records', {
    method: 'POST',
    body: JSON.stringify(recordData)
  }, token);
};

/**
 * Get all medical records created by the current vet,
 * or all records in the clinic for clinic-admins.
 */
export const getVetMedicalRecords = async (
  params?: { petId?: string; limit?: number; offset?: number },
  token?: string
): Promise<VetMedicalRecordsResponse> => {
  const query = new URLSearchParams();
  if (params?.petId) query.set('petId', params.petId);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return authenticatedFetch(`/medical-records/vet/my-records${qs}`, { method: 'GET' }, token);
};

/**
 * Get the medical record linked to a specific appointment.
 */
export const getRecordByAppointment = async (appointmentId: string, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch(`/medical-records/appointment/${appointmentId}`, { method: 'GET' }, token);
};

/**
 * Get all medical records for a pet (current + historical)
 */
export const getRecordsByPet = async (petId: string, token?: string): Promise<CurrentAndHistoricalRecordsResponse> => {
  return authenticatedFetch(`/medical-records/pet/${petId}`, { method: 'GET' }, token);
};

/**
 * Get the current medical record for a pet
 */
export const getCurrentRecord = async (petId: string, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch(`/medical-records/pet/${petId}/current`, { method: 'GET' }, token);
};

/**
 * Get all historical medical records for a pet (non-current records)
 */
export const getHistoricalRecords = async (petId: string, token?: string): Promise<MedicalRecordsResponse> => {
  return authenticatedFetch(`/medical-records/pet/${petId}/historical`, { method: 'GET' }, token);
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
  vitals: Partial<Vitals>;
  images: { data: string; contentType: string; description?: string }[];
  overallObservation: string;
  visitSummary: string;
  vetNotes: string;
  sharedWithOwner: boolean;
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
