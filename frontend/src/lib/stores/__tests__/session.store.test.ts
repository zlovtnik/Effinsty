import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from '$lib/stores/session.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.reset();
  });

  it('starts without an active session expiry', () => {
    expect(get(sessionStore)).toEqual({
      expiresAt: null,
    });
  });

  it('stores session expiry metadata in memory only', () => {
    sessionStore.setExpiresAt(TEST_SESSION_EXPIRY);

    expect(get(sessionStore)).toEqual({
      expiresAt: TEST_SESSION_EXPIRY,
    });
  });

  it('clears session expiry during clear', () => {
    sessionStore.setExpiresAt(TEST_SESSION_EXPIRY);
    sessionStore.clear();

    expect(get(sessionStore)).toEqual({
      expiresAt: null,
    });
  });

  it('stores session snapshot for lifecycle helpers', () => {
    sessionStore.setExpiresAt(TEST_SESSION_EXPIRY);

    expect(sessionStore.getSession()).toEqual({
      expiresAt: TEST_SESSION_EXPIRY,
    });
    expect(sessionStore.isSessionExpired()).toBe(false);
  });

  it('reports expired sessions', () => {
    sessionStore.setExpiresAt('2000-01-01T00:00:00.000Z');

    expect(sessionStore.getSession()).toEqual({
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    expect(sessionStore.isSessionExpired()).toBe(true);
  });
});
