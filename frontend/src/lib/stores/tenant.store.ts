import { writable } from 'svelte/store';
import type { PresentedError } from '$lib/services/error/error-presenter';

export type TenantResolutionStatus = 'unknown' | 'resolved' | 'invalid';

export interface TenantState {
  tenantId: string | null;
  status: TenantResolutionStatus;
  invalidReason: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: TenantState = {
  tenantId: null,
  status: 'unknown',
  invalidReason: null,
  loading: false,
  error: null,
};

export function createTenantStore() {
  const { subscribe, set, update } = writable<TenantState>(initialState);

  return {
    subscribe,
    setTenant: (tenantId: string) =>
      update((state) => ({
        ...state,
        tenantId,
        status: 'unknown',
        invalidReason: null,
        loading: false,
        error: null,
      })),
    resolveTenant: (tenantId?: string) =>
      update((state) => ({
        ...state,
        tenantId: tenantId ?? state.tenantId,
        status: 'resolved',
        invalidReason: null,
        loading: false,
        error: null,
      })),
    invalidateTenant: (message: string, tenantId?: string) =>
      update((state) => ({
        ...state,
        tenantId: tenantId ?? state.tenantId,
        status: 'invalid',
        invalidReason: message,
        loading: false,
        error: message,
      })),
    applyPresentedError: (error: PresentedError, tenantId?: string) =>
      update((state) => ({
        ...state,
        tenantId: tenantId ?? state.tenantId,
        status: error.kind === 'forbidden' ? 'invalid' : state.status,
        invalidReason: error.kind === 'forbidden' ? error.message : state.invalidReason,
        loading: false,
        error: error.message,
      })),
    setError: (message: string) =>
      update((state) => ({
        ...state,
        error: message,
      })),
    clear: () => set(initialState),
    reset: () => set(initialState),
  };
}

export const tenantStore = createTenantStore();
