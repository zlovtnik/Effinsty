import { writable } from 'svelte/store';
import {
  sessionStorageService,
  type SessionSnapshot,
  type SessionStorage,
} from '$lib/infrastructure/storage/session-storage';

export interface SessionState {
  expiresAt: string | null;
}

export interface SessionStoreDependencies {
  storage?: SessionStorage;
}

function toState(snapshot: SessionSnapshot): SessionState {
  return {
    expiresAt: snapshot.expiresAt,
  };
}

export function createSessionStore(dependencies: SessionStoreDependencies = {}) {
  const storage = dependencies.storage ?? sessionStorageService;
  const { subscribe, set } = writable<SessionState>(toState(storage.getSnapshot()));

  function sync(snapshot: SessionSnapshot): SessionSnapshot {
    set(toState(snapshot));
    return snapshot;
  }

  return {
    subscribe,
    setExpiresAt: (expiresAt: string) => sync(storage.setExpiresAt(expiresAt)),
    getSession: (): SessionSnapshot => storage.getSnapshot(),
    isSessionExpired: (leewayMs = 0): boolean => storage.isSessionExpired(leewayMs),
    clear: () => sync(storage.clear()),
    reset: () => sync(storage.clear()),
  };
}

export const sessionStore = createSessionStore();
