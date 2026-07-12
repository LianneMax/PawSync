import { authenticatedFetch } from './auth';

export interface PetNotesData {
  notes: string;
  updatedAt?: string | null;
  updatedBy?: { firstName: string; lastName: string } | null;
}

export const getPetNotes = async (
  petId: string,
  token?: string
): Promise<{ status: string; data?: PetNotesData; message?: string }> => {
  return authenticatedFetch(`/pet-notes/${petId}`, { method: 'GET' }, token);
};

export const savePetNotes = async (
  petId: string,
  notes: string,
  token?: string
): Promise<{ status: string; data?: PetNotesData; message?: string }> => {
  return authenticatedFetch(`/pet-notes/${petId}`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  }, token);
};
