import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth.store';

describe('authStore', () => {
  beforeEach(() => {
    authStore.reset();
  });

  it('starts unauthenticated', () => {
    expect(get(authStore)).toEqual({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      loading: false,
      error: null,
    });
  });

  it('sets loading state on login start', () => {
    authStore.startLogin();

    expect(get(authStore).loading).toBe(true);
    expect(get(authStore).error).toBeNull();
  });

  it('stores in-memory auth tokens after login success', () => {
    authStore.completeLogin({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
    });

    expect(get(authStore)).toMatchObject({
      isAuthenticated: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
      loading: false,
      error: null,
    });
  });

  it('clears session values on failed login', () => {
    authStore.completeLogin({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
    });

    authStore.failLogin('Invalid credentials.');

    expect(get(authStore)).toEqual({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      loading: false,
      error: 'Invalid credentials.',
    });
  });
});
