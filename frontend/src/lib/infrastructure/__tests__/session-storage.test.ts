import { describe, expect, it, vi } from 'vitest';
import { createMemorySessionStorage } from '$lib/infrastructure/storage/session-storage';

describe('memory session storage', () => {
  it('stores and returns session metadata', () => {
    const storage = createMemorySessionStorage();

    storage.setExpiresAt('2099-01-01T00:00:00.000Z');

    expect(storage.getSnapshot()).toEqual({
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('overwrites expiry when session metadata changes', () => {
    const storage = createMemorySessionStorage();

    storage.setExpiresAt('2099-01-01T00:00:00.000Z');
    storage.setExpiresAt('2099-01-02T00:00:00.000Z');

    expect(storage.getSnapshot()).toEqual({
      expiresAt: '2099-01-02T00:00:00.000Z',
    });
  });

  it('reports session expiry using the provided leeway', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00.000Z'));

    const storage = createMemorySessionStorage();
    storage.setExpiresAt('2026-03-13T12:00:30.000Z');

    expect(storage.isSessionExpired()).toBe(false);
    expect(storage.isSessionExpired(31_000)).toBe(true);

    vi.useRealTimers();
  });

  it('clears all session metadata', () => {
    const storage = createMemorySessionStorage();
    storage.setExpiresAt('2099-01-01T00:00:00.000Z');

    storage.clear();

    expect(storage.getSnapshot()).toEqual({
      expiresAt: null,
    });
  });
});
