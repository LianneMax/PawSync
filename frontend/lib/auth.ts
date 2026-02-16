// Frontend API utility for auth requests

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface AuthResponse {
  status: 'SUCCESS' | 'ERROR';
  message: string;
  code?: string;
  attemptsRemaining?: number;
  lockUntil?: string;
  data?: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      userType: 'pet-owner' | 'veterinarian' | 'clinic-admin';
      isVerified: boolean;
    };
    token: string;
    resetToken?: string;
  };
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'pet-owner' | 'veterinarian' | 'clinic-admin';
  isVerified: boolean;
}

/**
 * Register a new user
 */
export const register = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string,
  userType: 'pet-owner' | 'veterinarian' | 'clinic-admin',
  clinicName?: string,
  branchDetails?: {
    name?: string
    address?: string
    city?: string
    province?: string
    phone?: string
    email?: string
    openingTime?: string
    closingTime?: string
    operatingDays?: string[]
  },
  clinicLogo?: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      userType,
      ...(clinicName && { clinicName }),
      ...(branchDetails && { branchDetails }),
      ...(clinicLogo && { clinicLogo })
    })
  });

  return await response.json();
};

/**
 * Login user
 */
export const login = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  return await response.json();
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (token: string): Promise<{ status: string; data?: { user: User } }> => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return await response.json();
};

/**
 * Logout user
 */
export const logout = async (): Promise<{ status: string; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return await response.json();
};

/**
 * Forgot password - send OTP to email
 */
export const forgotPassword = async (
  email: string
): Promise<{ status: string; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await response.json();
};

/**
 * Verify OTP
 */
export const verifyOtp = async (
  email: string,
  otp: string
): Promise<{ status: string; message: string; data?: { resetToken: string } }> => {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  return await response.json();
};

/**
 * Reset password
 */
export const resetPassword = async (
  email: string,
  resetToken: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ status: string; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetToken, newPassword, confirmPassword })
  });
  return await response.json();
};

/**
 * Make authenticated API request
 */
export const authenticatedFetch = async (
  endpoint: string,
  options: RequestInit = {},
  token?: string
) => {
  const storedToken = token || localStorage.getItem('authToken');

  const headers = {
    'Content-Type': 'application/json',
    ...(storedToken && { 'Authorization': `Bearer ${storedToken}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  return await response.json();
};
