import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '$lib/api/client';
import { isRequestError } from '$lib/api/errors';

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;

describe('api/client request', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    vi.useRealTimers();
  });

  it('sends required headers and captures response correlation id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': 'corr-response',
        },
      })
    );

    globalThis.fetch = fetchMock as typeof fetch;

    let capturedCorrelationId = '';

    const response = await request<{ ok: boolean }>('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      correlationId: 'corr-request',
      retry: { attempts: 1, backoffMs: 0 },
      onResponseMeta: (meta) => {
        capturedCorrelationId = meta.correlationId;
      },
    });

    expect(response).not.toBeNull();
    if (response === null) {
      throw new Error('Expected JSON response body.');
    }

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get('X-Tenant-ID')).toBe('tenant-a');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Correlation-ID')).toBe('corr-request');
    expect(capturedCorrelationId).toBe('corr-response');
  });

  it('generates a correlation id when not provided', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'generated-correlation-id' },
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    globalThis.fetch = fetchMock as typeof fetch;

    await request<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      tenantId: 'tenant-a',
      body: { username: 'user', password: 'pass' },
      retry: { attempts: 1, backoffMs: 0 },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get('X-Correlation-ID')).toBe('generated-correlation-id');
  });

  it('throws when tenant header is missing for tenant-scoped paths', async () => {
    await expect(
      request('/contacts', {
        method: 'GET',
      })
    ).rejects.toSatisfy((error: unknown) => {
      if (!isRequestError(error)) {
        return false;
      }

      return error.appError.code === 'client_configuration';
    });
  });

  it('retries idempotent reads only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'temporary' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const response = await request<{ ok: boolean }>('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      retry: { attempts: 2, backoffMs: 0 },
    });

    expect(response).not.toBeNull();
    if (response === null) {
      throw new Error('Expected JSON response body.');
    }

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff between GET retries', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'temporary' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'temporary' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const pending = request('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      retry: { attempts: 3, backoffMs: 5 },
    });

    await vi.runAllTimersAsync();
    await pending;

    const delays = setTimeoutSpy.mock.calls.map(([, delay]) => delay);
    expect(delays).toContain(5);
    expect(delays).toContain(10);
  });

  it('does not retry mutation requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'temporary' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      request('/auth/login', {
        method: 'POST',
        tenantId: 'tenant-a',
        body: { username: 'user', password: 'pass' },
        retry: { attempts: 3, backoffMs: 0 },
      })
    ).rejects.toSatisfy((error: unknown) => isRequestError(error));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps timeout failures to timeout app errors', async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn((_, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const promise = request('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      timeoutMs: 5,
      retry: { attempts: 1, backoffMs: 0 },
    });

    const assertion = expect(promise).rejects.toSatisfy((error: unknown) => {
      if (!isRequestError(error)) {
        return false;
      }

      return error.appError.kind === 'timeout';
    });

    await vi.advanceTimersByTimeAsync(10);

    await assertion;
  });

  it('does not retry caller-aborted requests and maps them to canceled errors', async () => {
    const callerAbort = new AbortController();

    globalThis.fetch = vi.fn((_, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const promise = request('/contacts', {
      method: 'GET',
      tenantId: 'tenant-a',
      signal: callerAbort.signal,
      timeoutMs: 5_000,
      retry: { attempts: 2, backoffMs: 0 },
    });

    callerAbort.abort();

    await expect(promise).rejects.toSatisfy((error: unknown) => {
      if (!isRequestError(error)) {
        return false;
      }

      return error.appError.kind === 'canceled';
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not force JSON content-type for form data payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    globalThis.fetch = fetchMock as typeof fetch;

    const payload = new FormData();
    payload.append('username', 'alice');

    await request('/auth/login', {
      method: 'POST',
      tenantId: 'tenant-a',
      body: payload,
      retry: { attempts: 1, backoffMs: 0 },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get('Content-Type')).toBeNull();
    expect(init.body).toBe(payload);
  });
});
