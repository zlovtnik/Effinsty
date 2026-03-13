export interface SessionSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
}

export interface SessionStorage {
  getSnapshot(): SessionSnapshot;
  setTokens(next: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }): SessionSnapshot;
  setAccessToken(accessToken: string, expiresAt: string): SessionSnapshot;
  setRefreshToken(refreshToken: string): SessionSnapshot;
  clear(): SessionSnapshot;
  hasRefreshToken(): boolean;
  isAccessTokenExpired(leewayMs?: number): boolean;
}

export const EMPTY_SESSION_SNAPSHOT: SessionSnapshot = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

function cloneSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return { ...snapshot };
}

function toExpiryTime(expiresAt: string | null): number | null {
  if (!expiresAt) {
    return null;
  }

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function createMemorySessionStorage(
  initialSnapshot: SessionSnapshot = EMPTY_SESSION_SNAPSHOT
): SessionStorage {
  let snapshot = cloneSnapshot(initialSnapshot);

  return {
    getSnapshot(): SessionSnapshot {
      return cloneSnapshot(snapshot);
    },
    setTokens(next): SessionSnapshot {
      snapshot = {
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
        expiresAt: next.expiresAt,
      };
      return cloneSnapshot(snapshot);
    },
    setAccessToken(accessToken: string, expiresAt: string): SessionSnapshot {
      snapshot = {
        ...snapshot,
        accessToken,
        expiresAt,
      };
      return cloneSnapshot(snapshot);
    },
    setRefreshToken(refreshToken: string): SessionSnapshot {
      snapshot = {
        ...snapshot,
        refreshToken,
      };
      return cloneSnapshot(snapshot);
    },
    clear(): SessionSnapshot {
      snapshot = cloneSnapshot(EMPTY_SESSION_SNAPSHOT);
      return cloneSnapshot(snapshot);
    },
    hasRefreshToken(): boolean {
      return Boolean(snapshot.refreshToken);
    },
    isAccessTokenExpired(leewayMs = 0): boolean {
      if (!snapshot.accessToken) {
        return true;
      }

      const expiryTime = toExpiryTime(snapshot.expiresAt);
      if (expiryTime === null) {
        return true;
      }

      return expiryTime <= Date.now() + Math.max(leewayMs, 0);
    },
  };
}

export const sessionStorageService = createMemorySessionStorage();
