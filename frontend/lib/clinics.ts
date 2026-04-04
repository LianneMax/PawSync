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

export type OwnerInviteStatus = 'pending' | 'invited' | 'resent' | 'expired' | 'activated';

export interface ClinicPetOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string | null;
  photo: string | null;
  inviteStatus: OwnerInviteStatus;
  inviteSentAt: string;
  lastInviteSentAt: string;
  activatedAt: string | null;
  petCount: number;
}

export interface OwnerPetSummary {
  id: string;
  name: string;
  species: 'canine' | 'feline';
  breed: string;
  photo: string | null;
  dateOfBirth: string;
  sex: string;
  weight: number;
  lastVisit: string | null;
  dueVaccinations: { id: string; vaccineName: string; nextDueDate: string | null; status: string }[];
}

export interface SingleOwnerResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    owner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      contactNumber: string | null;
      photo: string | null;
      inviteStatus: OwnerInviteStatus;
      activatedAt: string | null;
      createdAt: string;
    };
    pets: OwnerPetSummary[];
  };
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
 * Send or resend the activation invite to a pet owner.
 * Works for both first-time sends (inviteStatus: 'pending') and resends.
 * Cooldown is only enforced on resends.
 */
export const sendPetOwnerInvite = async (
  ownerId: string,
  token?: string
): Promise<{ status: string; message?: string }> => {
  return authenticatedFetch(`/clinics/mine/pet-owners/${ownerId}/resend-invite`, {
    method: 'POST',
  }, token);
};

/** @deprecated use sendPetOwnerInvite */
export const resendPetOwnerInvite = sendPetOwnerInvite;

/**
 * Check if an email or phone number is already registered (before creating a client).
 */
export const checkClientAvailability = async (
  params: { email?: string; contactNumber?: string },
  token?: string
): Promise<{ status: string; data?: { conflicts: Record<string, string> } }> => {
  const q = new URLSearchParams();
  if (params.email) q.set('email', params.email);
  if (params.contactNumber) q.set('contactNumber', params.contactNumber);
  return authenticatedFetch(`/clinics/mine/pet-owners/check-availability?${q}`, { method: 'GET' }, token);
};

/**
 * Get a single pet owner profile with pets, last visit, and due vaccinations.
 */
export const getSinglePetOwner = async (
  ownerId: string,
  token?: string
): Promise<SingleOwnerResponse> => {
  return authenticatedFetch(`/clinics/mine/pet-owners/${ownerId}`, { method: 'GET' }, token);
};

/**
 * Send a follow-up note email from the clinic/vet to a pet owner.
 */
export const sendOwnerNote = async (
  ownerId: string,
  data: { note: string; vetName?: string },
  token?: string
): Promise<{ status: string; message?: string }> => {
  return authenticatedFetch(`/clinics/mine/pet-owners/${ownerId}/send-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, token);
};
