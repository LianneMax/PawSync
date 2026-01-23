import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'pet-owner' | 'veterinarian';
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isAuthenticated: () => boolean;
}

/**
 * Auth store using Zustand for global state management
 * Persists auth state to localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: (user: User, token: string) => {
        set({ user, token, error: null });
      },

      logout: () => {
        set({ user: null, token: null });
      },

      setUser: (user: User | null) => {
        set({ user });
      },

      setToken: (token: string | null) => {
        set({ token });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      isAuthenticated: () => {
        const { user, token } = get();
        return !!user && !!token;
      }
    }),
    {
      name: 'auth-store', // Key in localStorage
      partialize: (state) => ({
        user: state.user,
        token: state.token
      })
    }
  )
);
