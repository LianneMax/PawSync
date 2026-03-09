import { authenticatedFetch } from './auth';

export const getPetNotes = async (
  petId: string,
  token?: string
): Promise<{ status: string; data?: { notes: string }; message?: string }> => {
  return authenticatedFetch(`/pet-notes/${petId}`, { method: 'GET' }, token);
};

export const savePetNotes = async (
  petId: string,
  notes: string,
  token?: string
): Promise<{ status: string; data?: { notes: string }; message?: string }> => {
  return authenticatedFetch(`/pet-notes/${petId}`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  }, token);
};
