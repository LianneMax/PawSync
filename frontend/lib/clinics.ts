import { authenticatedFetch } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ClinicBranch {
  _id: string;
  name: string;
  address: string;
  isMain: boolean;
}

export interface ClinicWithBranches {
  _id: string;
  name: string;
  address: string | null;
  branches: ClinicBranch[];
}

export interface BranchVet {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Get all active clinics with their branches (public endpoint)
 */
export const getAllClinicsWithBranches = async (): Promise<{ status: string; data?: { clinics: ClinicWithBranches[] } }> => {
  const response = await fetch(`${API_BASE_URL}/clinics`, { method: 'GET' });
  return await response.json();
};

/**
 * Get approved vets for a specific clinic branch
 */
export const getVetsForBranch = async (branchId: string, token?: string): Promise<{ status: string; data?: { vets: BranchVet[] } }> => {
  return authenticatedFetch(`/appointments/branch-vets?branchId=${branchId}`, { method: 'GET' }, token);
};

export interface ClinicPatient {
  _id: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  photo: string | null;
  microchipNumber: string | null;
  bloodType: string | null;
  owner: {
    _id: string;
    firstName: string;
    lastName: string;
    contactNumber: string;
    email: string;
  };
  recordCount: number;
  lastVisit: string;
}

export interface ClinicPatientsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    patients: ClinicPatient[];
  };
}

/**
 * Get all patients for a clinic
 */
export const getClinicPatients = async (
  clinicId: string,
  token?: string
): Promise<ClinicPatientsResponse> => {
  return authenticatedFetch(`/clinics/${clinicId}/patients`, { method: 'GET' }, token);
};
