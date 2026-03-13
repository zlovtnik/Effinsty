import { writable } from 'svelte/store';
import type { AuthTokens } from '$lib/api/auth';

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  expiresAt: null,
  loading: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    startLogin: () =>
      update((state) => ({
        ...state,
        loading: true,
        error: null,
      })),
    completeLogin: (session: AuthTokens) =>
      set({
        isAuthenticated: true,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        loading: false,
        error: null,
      }),
    setSession: (accessToken: string, expiresAt: string) =>
      set({
        isAuthenticated: true,
        accessToken,
        expiresAt,
        loading: false,
        error: null,
      }),
    failLogin: (message: string) =>
      set({
        ...initialState,
        loading: false,
        error: message,
      }),
    reset: () => set(initialState),
  };
}

export const authStore = createAuthStore();
