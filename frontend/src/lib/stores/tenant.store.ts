import { writable } from 'svelte/store';

export interface TenantState {
  tenantId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: TenantState = {
  tenantId: 'tenant-a',
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
        error: null,
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
