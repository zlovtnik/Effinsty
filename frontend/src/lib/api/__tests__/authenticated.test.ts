// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';
import { logoutCurrentSession, requestWithAuth } from '$lib/api/authenticated';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

const gotoMock = vi.mocked(goto);
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('authenticated request orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    sessionStore.reset();
    tenantStore.reset();
    window.history.replaceState({}, '', '/dashboard/contacts?page=1');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('refreshes once and retries the original request after a 401', async () => {
    authStore.setSession('stale-access-token', TEST_SESSION_EXPIRY);
    sessionStore.setRefreshToken('refresh-old');
    tenantStore.resolveTenant('tenant-a');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: 'unauthorized',
            message: 'Access token expired.',
            details: [],
            correlationId: 'corr-401',
          },
          401
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            accessToken: 'fresh-access-token',
            refreshToken: 'refresh-new',
            expiresAt: TEST_SESSION_EXPIRY,
          },
          200
        )
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)) as typeof fetch;

    const response = await requestWithAuth<{ ok: boolean }>('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      accessToken: 'stale-access-token',
      retry: { attempts: 1, backoffMs: 0 },
    });

    expect(response).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toContain('/api/auth/refresh');
    expect(JSON.parse(String(refreshInit.body))).toEqual({ refreshToken: 'refresh-old' });

    const [, retriedRequest] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2] as [string, RequestInit];
    const retryHeaders = new Headers(retriedRequest.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer fresh-access-token');

    expect(get(authStore).accessToken).toBe('fresh-access-token');
    expect(get(sessionStore).refreshToken).toBe('refresh-new');
  });

  it('clears state and redirects to login when refresh fails', async () => {
    authStore.setSession('stale-access-token', TEST_SESSION_EXPIRY);
    sessionStore.setRefreshToken('refresh-old');
    tenantStore.resolveTenant('tenant-a');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: 'unauthorized',
            message: 'Access token expired.',
            details: [],
            correlationId: 'corr-401',
          },
          401
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: 'unauthorized',
            message: 'Refresh token expired.',
            details: [],
            correlationId: 'corr-refresh',
          },
          401
        )
      ) as typeof fetch;

    await expect(
      requestWithAuth<{ ok: boolean }>('/contacts', {
        method: 'GET',
        tenantId: 'tenant-a',
        accessToken: 'stale-access-token',
        retry: { attempts: 1, backoffMs: 0 },
      })
    ).rejects.toBeTruthy();

    expect(gotoMock).toHaveBeenCalledWith(
      '/login?returnTo=%2Fdashboard%2Fcontacts%3Fpage%3D1&reason=session-expired'
    );
    expect(get(authStore).isAuthenticated).toBe(false);
    expect(get(sessionStore).refreshToken).toBeNull();
    expect(get(tenantStore).tenantId).toBeNull();
  });

  it('shares one refresh request across concurrent 401 responses', async () => {
    authStore.setSession('stale-access-token', TEST_SESSION_EXPIRY);
    sessionStore.setRefreshToken('refresh-old');
    tenantStore.resolveTenant('tenant-a');

    let refreshCallCount = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/auth/refresh')) {
        refreshCallCount += 1;
        return jsonResponse(
          {
            accessToken: 'fresh-access-token',
            refreshToken: 'refresh-new',
            expiresAt: TEST_SESSION_EXPIRY,
          },
          200
        );
      }

      if (url.includes('/api/contacts')) {
        const headers = new Headers(init?.headers);
        if (headers.get('Authorization') === 'Bearer stale-access-token') {
          return jsonResponse(
            {
              code: 'unauthorized',
              message: 'Access token expired.',
              details: [],
              correlationId: 'corr-401',
            },
            401
          );
        }

        return jsonResponse({ ok: true }, 200);
      }

      throw new Error(`Unexpected request URL: ${url}`);
    }) as typeof fetch;

    await Promise.all([
      requestWithAuth<{ ok: boolean }>('/contacts', {
        method: 'GET',
        tenantId: 'tenant-a',
        accessToken: 'stale-access-token',
        retry: { attempts: 1, backoffMs: 0 },
      }),
      requestWithAuth<{ ok: boolean }>('/contacts', {
        method: 'GET',
        tenantId: 'tenant-a',
        accessToken: 'stale-access-token',
        retry: { attempts: 1, backoffMs: 0 },
      }),
    ]);

    expect(refreshCallCount).toBe(1);
  });

  it('calls logout with bearer token and refresh token payload', async () => {
    authStore.setSession('access-token', TEST_SESSION_EXPIRY);
    sessionStore.setRefreshToken('refresh-token');
    tenantStore.resolveTenant('tenant-a');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200)) as typeof fetch;

    await logoutCurrentSession();

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/logout');

    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('X-Tenant-ID')).toBe('tenant-a');
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-token' });

    expect(get(authStore).isAuthenticated).toBe(false);
    expect(get(sessionStore).refreshToken).toBeNull();
    expect(get(tenantStore).tenantId).toBeNull();
  });
});
