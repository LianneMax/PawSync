import { authenticatedFetch, User } from './auth';

export interface ProfileResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: {
    user: User & { createdAt?: string };
  };
}

/**
 * Get user profile
 */
export const getProfile = async (token?: string): Promise<ProfileResponse> => {
  return authenticatedFetch('/users/profile', { method: 'GET' }, token);
};

/** Veterinarian-only AI report style preferences (tone/format only; never clinical facts). */
export interface ReportStyleProfile {
  verbosity?: 'concise' | 'standard' | 'detailed';
  format?: 'prose' | 'bulleted';
  analogies?: boolean;
  readingLevel?: string;
  spelling?: 'US' | 'UK';
  extraNotes?: string;
}

/**
 * Update user profile
 */
export const updateProfile = async (
  data: { firstName?: string; lastName?: string; contactNumber?: string; reportStyleProfile?: ReportStyleProfile | null },
  token?: string
): Promise<ProfileResponse> => {
  return authenticatedFetch('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  }, token);
};

/**
 * Change password
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  token?: string
): Promise<{ status: string; message: string }> => {
  return authenticatedFetch('/users/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  }, token);
};
