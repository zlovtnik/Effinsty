import { writable } from 'svelte/store';
import {
  sessionStorageService,
  type SessionSnapshot,
  type SessionStorage,
} from '$lib/infrastructure/storage/session-storage';
import type { AuthTokens } from '$lib/services/auth/auth.service';

export interface SessionState {
  refreshToken: string | null;
}

export interface SessionStoreDependencies {
  storage?: SessionStorage;
}

function toState(snapshot: SessionSnapshot): SessionState {
  return {
    refreshToken: snapshot.refreshToken,
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
    setTokens: (tokens: AuthTokens) => sync(storage.setTokens(tokens)),
    setAccessToken: (accessToken: string, expiresAt: string) =>
      sync(storage.setAccessToken(accessToken, expiresAt)),
    setRefreshToken: (refreshToken: string) =>
      sync(storage.setRefreshToken(refreshToken)),
    getSession: (): SessionSnapshot => storage.getSnapshot(),
    hasRefreshToken: (): boolean => storage.hasRefreshToken(),
    isAccessTokenExpired: (leewayMs = 0): boolean =>
      storage.isAccessTokenExpired(leewayMs),
    clear: () => sync(storage.clear()),
    reset: () => sync(storage.clear()),
  };
}

export const sessionStore = createSessionStore();
