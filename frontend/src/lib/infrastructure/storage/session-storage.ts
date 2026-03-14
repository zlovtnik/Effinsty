export interface SessionSnapshot {
  expiresAt: string | null;
}

export interface SessionStorage {
  getSnapshot(): SessionSnapshot;
  setExpiresAt(expiresAt: string): SessionSnapshot;
  clear(): SessionSnapshot;
  isSessionExpired(leewayMs?: number): boolean;
}

export const EMPTY_SESSION_SNAPSHOT: SessionSnapshot = {
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
    setExpiresAt(expiresAt: string): SessionSnapshot {
      snapshot = {
        expiresAt,
      };
      return cloneSnapshot(snapshot);
    },
    clear(): SessionSnapshot {
      snapshot = cloneSnapshot(EMPTY_SESSION_SNAPSHOT);
      return cloneSnapshot(snapshot);
    },
    isSessionExpired(leewayMs = 0): boolean {
      const expiryTime = toExpiryTime(snapshot.expiresAt);
      if (expiryTime === null) {
        return true;
      }

      return expiryTime <= Date.now() + Math.max(leewayMs, 0);
    },
  };
}

export const sessionStorageService = createMemorySessionStorage();
