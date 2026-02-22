import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'pet-owner' | 'veterinarian' | 'clinic-admin' | 'branch-admin';
  isVerified: boolean;
  clinicId?: string;
  clinicBranchId?: string;
  branchId?: string;
  isMainBranch?: boolean;
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
 * Check if the authToken cookie exists.
 * When "remember me" is unchecked the cookie is a session cookie,
 * so it disappears after the browser is closed.
 */
function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith('authToken='));
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
        localStorage.removeItem('authToken');
        document.cookie = 'authToken=; path=/; max-age=0';
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
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token
      }),
      onRehydrateStorage: () => (state) => {
        // After Zustand restores from localStorage, check if the
        // authToken cookie still exists. If not, the browser was
        // closed without "remember me" — clear the session.
        if (state?.token && !hasAuthCookie()) {
          state.logout();
        }
      }
    }
  )
);
