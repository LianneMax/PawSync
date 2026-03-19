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

export interface Medication {
  _id?: string;
  name: string;
  dosage: string;
  route: 'oral' | 'topical' | 'injection' | 'other';
  frequency: string;
  duration: string;
  startDate: string | null;
  endDate: string | null;
  notes: string;
  status: 'active' | 'completed' | 'discontinued';
  quantity?: number | null;
}

export interface DiagnosticTest {
  _id?: string;
  testType: 'blood_work' | 'x_ray' | 'ultrasound' | 'urinalysis' | 'ecg' | 'other';
  name: string;
  date: string | null;
  result: string;
  normalRange: string;
  notes: string;
}

export interface PreventiveCare {
  _id?: string;
  careType: 'flea' | 'tick' | 'heartworm' | 'deworming' | 'other';
  product: string;
  dateAdministered: string | null;
  nextDueDate: string | null;
  notes: string;
}

export interface PregnancyRecord {
  isPregnant: boolean;
  gestationDate: string | null;
  expectedDueDate: string | null;
  litterNumber: number | null;
  confirmationMethod?: 'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown';
  confirmationSource?: 'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown';
  confidence?: 'high' | 'medium' | 'low';
  confirmedAt?: string | null;
  notes?: string;
}

export interface PregnancyDelivery {
  deliveryDate: string | null;
  deliveryType: string;
  laborDuration: string;
  liveBirths: number;
  stillBirths: number;
  motherCondition: 'stable' | 'critical' | 'recovering';
  vetRemarks: string;
  deliveryLocation?: 'in_clinic' | 'outside_clinic' | 'unknown';
  reportedBy?: 'vet' | 'owner' | 'external_vet' | 'unknown';
}

export interface PregnancyLoss {
  lossDate: string | null;
  lossType: 'miscarriage' | 'reabsorption' | 'abortion' | 'other';
  gestationalAgeAtLoss: number | null;
  notes: string;
  reportedBy: 'vet' | 'owner' | 'external_vet' | 'unknown';
}

export interface FollowUp {
  _id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vetId: any;
  ownerObservations: string;
  vetNotes: string;
  sharedWithOwner: boolean;
  media?: { _id?: string; data?: string; contentType: string; description: string }[];
  createdAt: string;
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
  stage: 'pre_procedure' | 'in_procedure' | 'post_procedure' | 'completed';
  chiefComplaint: string;
  vitals: Vitals;
  images: ImageFragment[];
  visitSummary: string;
  vetNotes?: string;
  overallObservation: string;
  subjective: string;
  assessment: string;
  plan: string;
  medications: Medication[];
  diagnosticTests: DiagnosticTest[];
  preventiveCare: PreventiveCare[];
  sharedWithOwner: boolean;
  isCurrent: boolean;
  confinementAction: 'none' | 'confined' | 'released';
  confinementDays: number;
  pregnancyRecord?: PregnancyRecord | null;
  pregnancyDelivery?: PregnancyDelivery | null;
  pregnancyLoss?: PregnancyLoss | null;
  surgeryRecord?: { surgeryType: string; vetRemarks: string; images?: ImageFragment[] } | null;
  billingId?: string;
  followUps?: FollowUp[];
  referral?: boolean;
  discharge?: boolean;
  scheduledSurgery?: boolean;
  immunityTesting?: {
    enabled: boolean;
    species: string;
    kitName: string;
    testDate: string;
    rows: { disease: string; score: number | null; status: string; action: string }[];
    protectedCount: number;
    summary: string;
    markdown: string;
    tag: string;
    linkedAppointmentId: string | null;
    followUpAppointmentId: string | null;
    followUpDate: string | null;
    skipSuggested: boolean;
    ignoreTiter: boolean;
    ignoreReason: string;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vaccinations?: any[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vaccineTypeId?: any;
  vaccineName: string;
  administeredDoseMl?: number | null;
  dateAdministered: string | null;
  expiryDate: string | null;
  nextDueDate: string | null;
  manufacturer?: string;
  batchNumber?: string;
  route?: string | null;
  doseNumber?: number;
  notes?: string;
  status: 'active' | 'expired' | 'overdue' | 'pending';
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
  subjective?: string;
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
 * Add a follow-up to an active medical record.
 * Only allowed when the record's isCurrent is true.
 */
export const createFollowUp = async (
  recordId: string,
  data: { ownerObservations: string; vetNotes?: string; sharedWithOwner?: boolean; media?: { data: string; contentType: string; description: string }[] },
  token?: string
): Promise<{ status: string; message?: string; data?: { followUps: FollowUp[] } }> => {
  return authenticatedFetch(`/medical-records/${recordId}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify(data)
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
  stage: MedicalRecord['stage'];
  chiefComplaint: string;
  vitals: Partial<Vitals>;
  images: { data: string; contentType: string; description?: string }[];
  overallObservation: string;
  visitSummary: string;
  vetNotes: string;
  subjective: string;
  assessment: string;
  plan: string;
  medications: Omit<Medication, '_id'>[];
  diagnosticTests: Omit<DiagnosticTest, '_id'>[];
  preventiveCare: Omit<PreventiveCare, '_id'>[];
  sharedWithOwner: boolean;
  confinementAction: 'none' | 'confined' | 'released';
  confinementDays: number;
  surgeryRecord: { surgeryType: string; vetRemarks: string; images?: { data: string; contentType: string; description: string }[] } | null;
  pregnancyRecord: PregnancyRecord | null;
  pregnancyDelivery: PregnancyDelivery | null;
  pregnancyLoss: PregnancyLoss | null;
  referral: boolean;
  discharge: boolean;
  scheduledSurgery: boolean;
  immunityTesting: MedicalRecord['immunityTesting'];
}>, token?: string): Promise<MedicalRecordResponse> => {
  return authenticatedFetch(`/medical-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }, token);
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

/**
 * Fetch diagnostic test services from the product-services catalog
 */
export interface ProductService {
  _id: string;
  name: string;
  type: 'Service' | 'Product';
  category: string;
  price: number;
  description: string;
  isActive: boolean;
  intervalDays?: number;
  administrationRoute?: 'oral' | 'topical' | 'injection';
  administrationMethod?: string;
  netContent?: number;
  dosePerKg?: number;
  doseUnit?: string;
  dosageAmount?: string;
  frequency?: number;
  frequencyLabel?: string;
  frequencyNotes?: string;
  duration?: number;
  durationLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductServicesResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { items: ProductService[] };
}

export const getDiagnosticTestServices = async (token?: string): Promise<ProductServicesResponse> => {
  return authenticatedFetch(`/product-services?type=Service&category=Diagnostic Tests`, { method: 'GET' }, token);
};

/**
 * Fetch medication services from the product-services catalog
 */
export const getMedicationServices = async (token?: string): Promise<ProductServicesResponse> => {
  return authenticatedFetch(`/product-services?type=Product&category=Medication`, { method: 'GET' }, token);
};

/**
 * Fetch preventive care services from the product-services catalog
 */
export const getPreventiveCareServices = async (token?: string): Promise<ProductServicesResponse> => {
  return authenticatedFetch(`/product-services?type=Service&category=Preventive Care`, { method: 'GET' }, token);
};

/**
 * Fetch surgery services from the product-services catalog
 */
export const getSurgeryServices = async (token?: string): Promise<ProductServicesResponse> => {
  return authenticatedFetch(`/product-services?type=Service&category=Surgeries`, { method: 'GET' }, token);
};

/**
 * Fetch pregnancy delivery services from the product-services catalog
 */
export const getPregnancyDeliveryServices = async (token?: string): Promise<ProductServicesResponse> => {
  return authenticatedFetch(`/product-services?type=Service&category=Pregnancy Delivery`, { method: 'GET' }, token);
};
