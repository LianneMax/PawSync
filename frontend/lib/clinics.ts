import { authenticatedFetch } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

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
  resignationStatus?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | null;
  resignationEndDate?: string | null;
  unavailableAfter?: string | null;
  isOnLeaveToday?: boolean;
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
  species: 'canine' | 'feline';
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
  status?: string;
  isAlive?: boolean;
  isLost?: boolean;
  isConfined?: boolean;
  removedByOwner?: boolean;
}

export interface ClinicPatientsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    patients: ClinicPatient[];
  };
}

/**
 * Get all patients for the authenticated clinic or branch admin
 */
export const getClinicPatients = async (
  token?: string
): Promise<ClinicPatientsResponse> => {
  return authenticatedFetch(`/clinics/mine/patients`, { method: 'GET' }, token);
};

// ─── Pet Owner Clients ─────────────────────────────────────────────────────────

export type OwnerInviteStatus = 'invited' | 'resent' | 'expired' | 'activated';

export interface ClinicPetOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string | null;
  inviteStatus: OwnerInviteStatus;
  inviteSentAt: string;
  lastInviteSentAt: string;
  activatedAt: string | null;
  petCount: number;
}

export interface ClinicPetOwnersResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    owners: ClinicPetOwner[];
    total: number;
  };
}

/**
 * Get all clinic-created pet owner profiles with onboarding status
 */
export const getClinicPetOwners = async (
  token?: string
): Promise<ClinicPetOwnersResponse> => {
  return authenticatedFetch(`/clinics/mine/pet-owners`, { method: 'GET' }, token);
};

/**
 * Create a new pet owner profile and send an activation invite
 */
export const createPetOwnerProfile = async (
  data: { firstName: string; lastName: string; email: string; contactNumber?: string },
  token?: string
): Promise<{ status: string; message?: string; data?: { owner: ClinicPetOwner } }> => {
  return authenticatedFetch(`/clinics/mine/pet-owners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, token);
};

/**
 * Resend the activation invite to a pet owner (invalidates old token)
 */
export const resendPetOwnerInvite = async (
  ownerId: string,
  token?: string
): Promise<{ status: string; message?: string }> => {
  return authenticatedFetch(`/clinics/mine/pet-owners/${ownerId}/resend-invite`, {
    method: 'POST',
  }, token);
};
