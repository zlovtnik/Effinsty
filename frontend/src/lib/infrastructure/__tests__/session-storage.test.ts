import { describe, expect, it, vi } from 'vitest';
import { createMemorySessionStorage } from '$lib/infrastructure/storage/session-storage';

describe('memory session storage', () => {
  it('stores and returns a full token snapshot', () => {
    const storage = createMemorySessionStorage();

    storage.setTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(storage.getSnapshot()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('preserves refresh token when only access token fields change', () => {
    const storage = createMemorySessionStorage();

    storage.setRefreshToken('refresh-token');
    storage.setAccessToken('access-token', '2099-01-01T00:00:00.000Z');

    expect(storage.getSnapshot()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('reports access token expiry using the provided leeway', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00.000Z'));

    const storage = createMemorySessionStorage();
    storage.setAccessToken('access-token', '2026-03-13T12:00:30.000Z');

    expect(storage.isAccessTokenExpired()).toBe(false);
    expect(storage.isAccessTokenExpired(31_000)).toBe(true);

    vi.useRealTimers();
  });

  it('clears all token state', () => {
    const storage = createMemorySessionStorage();
    storage.setTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    storage.clear();

    expect(storage.getSnapshot()).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
  });
});
