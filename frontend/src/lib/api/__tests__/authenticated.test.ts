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
    authStore.setAuthenticated(TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');

    const refreshedExpiry = '2099-02-01T00:00:00.000Z';
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
            expiresAt: refreshedExpiry,
          },
          200
        )
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)) as typeof fetch;

    const response = await requestWithAuth<{ ok: boolean }>('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      retry: { attempts: 1, backoffMs: 0 },
    });

    expect(response).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toContain('/api/auth/refresh');
    expect(refreshInit.body).toBeUndefined();

    const [, retriedRequest] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2] as [
      string,
      RequestInit,
    ];
    const retryHeaders = new Headers(retriedRequest.headers);
    expect(retryHeaders.get('Authorization')).toBeNull();
    expect(retryHeaders.get('X-Tenant-ID')).toBe('tenant-a');

    expect(get(authStore).expiresAt).toBe(refreshedExpiry);
    expect(get(sessionStore).expiresAt).toBe(refreshedExpiry);
  });

  it('clears state and redirects to login when refresh fails', async () => {
    authStore.setAuthenticated(TEST_SESSION_EXPIRY);
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
        retry: { attempts: 1, backoffMs: 0 },
      })
    ).rejects.toBeTruthy();

    expect(gotoMock).toHaveBeenCalledWith(
      '/login?returnTo=%2Fdashboard%2Fcontacts%3Fpage%3D1&reason=session-expired'
    );
    expect(get(authStore).isAuthenticated).toBe(false);
    expect(get(sessionStore).expiresAt).toBeNull();
    expect(get(tenantStore).tenantId).toBeNull();
  });

  it('shares one refresh request across concurrent 401 responses', async () => {
    authStore.setAuthenticated(TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');

    let refreshCallCount = 0;
    let contactsCallCount = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/refresh')) {
        refreshCallCount += 1;
        return jsonResponse(
          {
            expiresAt: TEST_SESSION_EXPIRY,
          },
          200
        );
      }

      if (url.includes('/api/contacts')) {
        contactsCallCount += 1;
        if (contactsCallCount <= 2) {
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
        retry: { attempts: 1, backoffMs: 0 },
      }),
      requestWithAuth<{ ok: boolean }>('/contacts', {
        method: 'GET',
        tenantId: 'tenant-a',
        retry: { attempts: 1, backoffMs: 0 },
      }),
    ]);

    expect(refreshCallCount).toBe(1);
  });

  it('calls logout with tenant context only', async () => {
    authStore.setAuthenticated(TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200)) as typeof fetch;

    await logoutCurrentSession();

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/api/auth/logout');

    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Tenant-ID')).toBe('tenant-a');
    expect(init.body).toBeUndefined();

    expect(get(authStore).isAuthenticated).toBe(false);
    expect(get(sessionStore).expiresAt).toBeNull();
    expect(get(tenantStore).tenantId).toBeNull();
  });
});
