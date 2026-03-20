import { authenticatedFetch } from './auth';

export interface Pet {
  _id: string;
  ownerId: string;
  status: 'alive' | 'lost' | 'deceased';
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
  tag_request_status?: 'pending' | 'approved' | null;
  qrCode: string | null;
  photo: string | null;
  color: string | null;
  bloodType: string | null;
  allergies: string[];
  notes?: string | null;
  pregnancyStatus: 'pregnant' | 'not_pregnant';
  assignedVetId: { _id: string; firstName: string; lastName: string; photo: string | null; clinicId?: string } | null;
  isLost: boolean;
  isAlive: boolean;
  deceasedAt: string | null;
  deceasedBy: string | null;
  lostReportedByStranger: boolean;
  lostContactName: string | null;
  lostContactNumber: string | null;
  lostMessage: string | null;
  isConfined: boolean;
  confinedSince: string | null;
  currentConfinementRecordId?: string | null;
  lastScannedLat: number | null;
  lastScannedLng: number | null;
  lastScannedAt: string | null;
  scanLocations: { lat: number; lng: number; scannedAt: string }[];
  previousOwners: { id: string; name: string; until: string }[];
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
  color?: string;
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
export const transferPet = async (
  id: string,
  payload: { newOwnerEmail?: string },
  token?: string
): Promise<{ status: string; message: string }> => {
  return authenticatedFetch(`/pets/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
};

export const searchTransferOwnerEmails = async (query: string, token?: string): Promise<{ status: string; data?: { emails: string[] } }> => {
  return authenticatedFetch(`/pets/transfer-owner-suggestions?q=${encodeURIComponent(query)}`, { method: 'GET' }, token);
};

export const markPetDeceased = async (
  id: string,
  payload?: { deceasedAt?: string },
  token?: string
): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}/mark-deceased`, {
    method: 'POST',
    body: JSON.stringify(payload || {})
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
 * Pet owner requests release confirmation from the handling veterinarian.
 */
export const requestConfinementRelease = async (petId: string, token?: string): Promise<{ status: string; message?: string; data?: any }> => {
  return authenticatedFetch(`/confinement/pet/${petId}/request-release`, {
    method: 'POST'
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
