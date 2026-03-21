import { authenticatedFetch } from './auth';

export interface CreateReferralData {
  petId: string;
  medicalRecordId: string;
  referredVetId: string;
  referredBranchId: string;
  referringBranchId: string;
  reason: string;
}

export const createReferral = async (
  data: CreateReferralData,
  token?: string
): Promise<{ status: string; message?: string; data?: { referral: { _id: string } } }> => {
  return authenticatedFetch('/referrals', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export interface ReferredPet {
  _id: string;
  name: string;
  species: string;
  breed: string;
  photo: string | null;
  sex: string;
  dateOfBirth: string | null;
  color: string | null;
  sterilization: string | null;
  nfcTagId: string | null;
  microchipNumber: string | null;
  allergies: string[];
  ownerId: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  clinicId: string;
  clinicName: string;
  clinicBranchId: string;
  clinicBranchName: string;
}

export const getReferredPets = async (
  token?: string
): Promise<{ status: string; message?: string; data?: { pets: ReferredPet[] } }> => {
  return authenticatedFetch('/referrals/referred-pets', { method: 'GET' }, token);
};
