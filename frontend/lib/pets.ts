import { authenticatedFetch } from './auth';

export interface Pet {
  _id: string;
  ownerId: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  secondaryBreed: string | null;
  sex: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  sterilization: 'yes' | 'no' | 'unknown';
  microchipNumber: string | null;
  nfcTagId: string | null;
  photo: string | null;
  notes: string | null;
  allergies: string[];
  isLost: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PetResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: { pet: Pet };
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
  species: 'dog' | 'cat';
  breed: string;
  secondaryBreed?: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  sterilization: 'yes' | 'no' | 'unknown';
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
 * Mark/unmark a pet as lost
 */
export const togglePetLost = async (id: string, isLost: boolean, token?: string): Promise<PetResponse> => {
  return authenticatedFetch(`/pets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isLost })
  }, token);
};
