import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

describe('authStore', () => {
  beforeEach(() => {
    authStore.reset();
  });

  it('starts unauthenticated', () => {
    expect(get(authStore)).toEqual({
      isAuthenticated: false,
      accessToken: null,
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
      expiresAt: TEST_SESSION_EXPIRY,
    });

    expect(get(authStore)).toMatchObject({
      isAuthenticated: true,
      accessToken: 'access-token',
      expiresAt: TEST_SESSION_EXPIRY,
      loading: false,
      error: null,
    });
  });

  it('clears session values on failed login', () => {
    authStore.completeLogin({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: TEST_SESSION_EXPIRY,
    });

    authStore.failLogin('Invalid credentials.');

    expect(get(authStore)).toEqual({
      isAuthenticated: false,
      accessToken: null,
      expiresAt: null,
      loading: false,
      error: 'Invalid credentials.',
    });
  });

  it('updates active access token on refresh success', () => {
    authStore.setSession('next-access-token', TEST_SESSION_EXPIRY);

    expect(get(authStore)).toEqual({
      isAuthenticated: true,
      accessToken: 'next-access-token',
      expiresAt: TEST_SESSION_EXPIRY,
      loading: false,
      error: null,
    });
  });
});
