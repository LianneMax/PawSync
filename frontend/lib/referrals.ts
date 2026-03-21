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
