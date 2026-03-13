import { writable } from 'svelte/store';

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

function createTenantStore() {
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
