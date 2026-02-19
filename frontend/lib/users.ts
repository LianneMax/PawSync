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

/**
 * Update user profile
 */
export const updateProfile = async (
  data: { firstName?: string; lastName?: string; contactNumber?: string },
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
