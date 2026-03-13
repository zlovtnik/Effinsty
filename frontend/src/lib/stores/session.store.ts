import { writable } from 'svelte/store';

export interface SessionState {
  refreshToken: string | null;
}

const initialState: SessionState = {
  refreshToken: null,
};

function createSessionStore() {
  const { subscribe, set } = writable<SessionState>(initialState);

  return {
    subscribe,
    setRefreshToken: (refreshToken: string) =>
      set({
        refreshToken,
      }),
    clear: () => set(initialState),
    reset: () => set(initialState),
  };
}

export const sessionStore = createSessionStore();
