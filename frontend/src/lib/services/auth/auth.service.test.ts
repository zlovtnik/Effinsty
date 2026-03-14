import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthService,
  type AuthService,
} from '$lib/services/auth/auth.service';

describe('auth service', () => {
  const httpClient = {
    post: vi.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAuthService({
      httpClient: httpClient as never,
    });
  });

  it('returns session metadata on login', async () => {
    httpClient.post.mockResolvedValue({
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
    expect(result.expiresAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('calls refresh without requiring a token payload', async () => {
    httpClient.post.mockResolvedValue({
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    await service.refresh('tenant-a');

    expect(httpClient.post).toHaveBeenCalledWith('/auth/refresh', {
      tenantId: 'tenant-a',
      correlationId: undefined,
    });
  });

  it('calls logout with tenant context only', async () => {
    httpClient.post.mockResolvedValue({ success: true });

    await service.logout('tenant-a');

    expect(httpClient.post).toHaveBeenCalledWith('/auth/logout', {
      tenantId: 'tenant-a',
      correlationId: undefined,
    });
  });
});
