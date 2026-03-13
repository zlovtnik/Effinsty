import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from '$lib/stores/session.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.reset();
  });

  it('starts without a refresh token', () => {
    expect(get(sessionStore)).toEqual({
      refreshToken: null,
    });
  });

  it('stores refresh token in memory only', () => {
    sessionStore.setRefreshToken('refresh-token');

    expect(get(sessionStore)).toEqual({
      refreshToken: 'refresh-token',
    });
  });

  it('clears refresh token during clear', () => {
    sessionStore.setRefreshToken('refresh-token');
    sessionStore.clear();

    expect(get(sessionStore)).toEqual({
      refreshToken: null,
    });
  });

  it('stores the full token snapshot for lifecycle helpers', () => {
    sessionStore.setTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: TEST_SESSION_EXPIRY,
    });

    expect(sessionStore.getSession()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: TEST_SESSION_EXPIRY,
    });
    expect(sessionStore.hasRefreshToken()).toBe(true);
    expect(sessionStore.isAccessTokenExpired()).toBe(false);
  });

  it('updates only access token fields when refreshing', () => {
    sessionStore.setRefreshToken('refresh-token');
    sessionStore.setAccessToken('access-token', '2000-01-01T00:00:00.000Z');

    expect(sessionStore.getSession()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    expect(sessionStore.isAccessTokenExpired()).toBe(true);
  });
});
