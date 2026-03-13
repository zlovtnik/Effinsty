import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemorySessionStorage } from '$lib/infrastructure/storage/session-storage';
import {
  createAuthService,
  type AuthService,
} from '$lib/services/auth/auth.service';

describe('auth service', () => {
  const httpClient = {
    post: vi.fn(),
  };
  const sessionStorage = createMemorySessionStorage();
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    service = createAuthService({
      httpClient: httpClient as never,
      sessionStorage,
    });
  });

  it('stores returned tokens on login', async () => {
    httpClient.post.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    const result = await service.login('tenant-a', {
      username: 'alice',
      password: 'password',
    });

    expect(httpClient.post).toHaveBeenCalledWith('/auth/login', {
      tenantId: 'tenant-a',
      body: { username: 'alice', password: 'password' },
      correlationId: undefined,
    });
    expect(result.refreshToken).toBe('refresh-token');
    expect(sessionStorage.getSnapshot().refreshToken).toBe('refresh-token');
  });

  it('stores refreshed tokens on refresh', async () => {
    httpClient.post.mockResolvedValue({
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    await service.refresh('tenant-a', {
      refreshToken: 'old-refresh-token',
    });

    expect(httpClient.post).toHaveBeenCalledWith('/auth/refresh', {
      tenantId: 'tenant-a',
      body: { refreshToken: 'old-refresh-token' },
      correlationId: undefined,
    });
    expect(sessionStorage.getSnapshot().accessToken).toBe('fresh-access-token');
  });

  it('clears storage on logout success', async () => {
    sessionStorage.setTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    httpClient.post.mockResolvedValue({ success: true });

    await service.logout(
      'tenant-a',
      { refreshToken: 'refresh-token' },
      'access-token'
    );

    expect(sessionStorage.getSnapshot()).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
  });
});
