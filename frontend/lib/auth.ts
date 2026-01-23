// Frontend API utility for auth requests

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface AuthResponse {
  status: 'SUCCESS' | 'ERROR';
  message: string;
  data?: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      userType: 'pet-owner' | 'veterinarian';
      isVerified: boolean;
    };
    token: string;
  };
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'pet-owner' | 'veterinarian';
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
  userType: 'pet-owner' | 'veterinarian'
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
      userType
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
