import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createMemorySessionStorage } from '$lib/infrastructure/storage/session-storage';
import { createAuthStore } from '$lib/stores/auth.store';
import { createSessionStore, sessionStore } from '$lib/stores/session.store';
import { createTenantStore, tenantStore } from '$lib/stores/tenant.store';
import { authStore } from '$lib/stores/auth.store';
import type { AuthService } from '$lib/services/auth/auth.service';
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

  it('delegates async login to the injected auth service', async () => {
    const storage = createMemorySessionStorage();
    const localSessionStore = createSessionStore({ storage });
    const localTenantStore = createTenantStore();
    const mockService: AuthService = {
      login: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: TEST_SESSION_EXPIRY,
      }),
      refresh: vi.fn(),
      logout: vi.fn(),
      isTokenExpired: vi.fn(),
      getAuthHeader: vi.fn(),
    };
    const store = createAuthStore({
      authService: mockService,
      sessionStore: localSessionStore as typeof sessionStore,
      tenantStore: localTenantStore as typeof tenantStore,
    });

    await store.login('tenant-a', {
      username: 'alice',
      password: 'password',
    });

    expect(mockService.login).toHaveBeenCalledWith('tenant-a', {
      username: 'alice',
      password: 'password',
    }, undefined);
    expect(get(store)).toMatchObject({
      isAuthenticated: true,
      accessToken: 'access-token',
      expiresAt: TEST_SESSION_EXPIRY,
      loading: false,
      error: null,
    });
    expect(localSessionStore.getSession().refreshToken).toBe('refresh-token');
    expect(get(localTenantStore).status).toBe('resolved');
  });

  it('shares one refresh request across concurrent callers', async () => {
    const storage = createMemorySessionStorage();
    const localSessionStore = createSessionStore({ storage });
    const localTenantStore = createTenantStore();
    const mockService: AuthService = {
      login: vi.fn(),
      refresh: vi.fn().mockResolvedValue({
        accessToken: 'fresh-access-token',
        refreshToken: 'refresh-token',
        expiresAt: TEST_SESSION_EXPIRY,
      }),
      logout: vi.fn(),
      isTokenExpired: vi.fn(),
      getAuthHeader: vi.fn(),
    };
    const store = createAuthStore({
      authService: mockService,
      sessionStore: localSessionStore as typeof sessionStore,
      tenantStore: localTenantStore as typeof tenantStore,
    });

    store.setSession('stale-access-token', TEST_SESSION_EXPIRY);
    localSessionStore.setRefreshToken('refresh-token');
    localTenantStore.resolveTenant('tenant-a');

    const [first, second] = await Promise.all([store.refresh(), store.refresh()]);

    expect(first).toBe('fresh-access-token');
    expect(second).toBe('fresh-access-token');
    expect(mockService.refresh).toHaveBeenCalledTimes(1);
  });
});
