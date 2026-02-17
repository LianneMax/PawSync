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
