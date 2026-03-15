import { authenticatedFetch } from './auth';

export interface Pet {
  _id: string;
  ownerId: string;
  name: string;
  species: 'canine' | 'feline';
  breed: string;
  secondaryBreed: string | null;
  sex: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  sterilization: 'spayed' | 'unspayed' | 'neutered' | 'unneutered' | 'unknown';
  microchipNumber: string | null;
  nfcTagId: string | null;
  qrCode: string | null;
  photo: string | null;
  notes: string | null;
  bloodType: string | null;
  allergies: string[];
  pregnancyStatus: 'pregnant' | 'not_pregnant';
  isLost: boolean;
  lostReportedByStranger: boolean;
  lostContactName: string | null;
  lostContactNumber: string | null;
  lostMessage: string | null;
  isConfined: boolean;
  confinedSince: string | null;
  lastScannedLat: number | null;
  lastScannedLng: number | null;
  lastScannedAt: string | null;
  scanLocations: { lat: number; lng: number; scannedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface PetResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { pet: Pet; confinementDays?: number };
}

export interface PetsResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { pets: Pet[] };
}

/**
 * Get all pets for the current user
 */
export const getMyPets = async (token?: string): Promise<PetsResponse> => {
  return authenticatedFetch('/pets', { method: 'GET' }, token);
};

/**
 * Get a single pet by ID
 */
export const getPetById = async (id: string, token?: string): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}`, { method: 'GET' }, token);
};

/**
 * Create a new pet
 */
export const createPet = async (petData: {
  name: string;
  species: 'canine' | 'feline';
  breed: string;
  secondaryBreed?: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  sterilization: 'spayed' | 'unspayed' | 'neutered' | 'unneutered' | 'unknown';
  microchipNumber?: string;
  nfcTagId?: string;
  photo?: string;
  notes?: string;
  allergies?: string[];
}, token?: string): Promise<PetResponse> => {
  return authenticatedFetch('/pets', {
    method: 'POST',
    body: JSON.stringify(petData)
  }, token);
};

/**
 * Update a pet
 */
export const updatePet = async (id: string, updates: Partial<Pet>, token?: string): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }, token);
};

/**
 * Delete a pet
 */
export const deletePet = async (id: string, token?: string): Promise<{ status: string; message: string }> => {
  return authenticatedFetch(`/pets/${id}`, { method: 'DELETE' }, token);
};

/**
 * Remove a pet with a reason
 */
export const removePet = async (id: string, reason: string, details?: string, token?: string): Promise<{ status: string; message: string }> => {
  return authenticatedFetch(`/pets/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason, details })
  }, token);
};

/**
 * Request a pet tag for a pet
 */
export const requestPetTag = async (petId: string, clinicBranchId: string, pickupDate: string, reason?: string, token?: string): Promise<{ status: string; message: string; data?: any }> => {
  return authenticatedFetch(`/nfc/pet/${petId}/request-tag`, {
    method: 'POST',
    body: JSON.stringify({
      clinicBranchId,
      pickupDate,
      reason: reason || ''
    })
  }, token);
};

/**
 * Transfer pet ownership to another pet-owner
 */
export const transferPet = async (id: string, newOwnerEmail: string, token?: string): Promise<{ status: string; message: string }> => {
  return authenticatedFetch(`/pets/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ newOwnerEmail })
  }, token);
};

/**
 * Mark/unmark a pet as lost
 */
export const togglePetLost = async (
  id: string,
  isLost: boolean,
  token?: string,
  contactInfo?: { lostContactName?: string | null; lostContactNumber?: string | null; lostMessage?: string | null; lostReportedByStranger?: boolean }
): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isLost, ...contactInfo })
  }, token);
};

/**
 * Mark/unmark a pet as confined.
 * Uses a dedicated endpoint accessible by both pet owners and treating vets.
 */
export const updatePetConfinement = async (id: string, isConfined: boolean, token?: string): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}/confined`, {
    method: 'PATCH',
    body: JSON.stringify({ isConfined })
  }, token);
};

/**
 * Update a pet's pregnancy status.
 * Accessible by the pet owner, treating vet, or clinic admin.
 */
export const updatePetPregnancyStatus = async (id: string, pregnancyStatus: 'pregnant' | 'not_pregnant', token?: string): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}/pregnancy-status`, {
    method: 'PATCH',
    body: JSON.stringify({ pregnancyStatus })
  }, token);
};

/**
 * Mark/unmark a pet as confined (legacy alias — prefer updatePetConfinement)
 * @deprecated Use updatePetConfinement instead
 */
export const togglePetConfined = updatePetConfinement;
