import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadHttpConfigModule() {
  vi.resetModules();
  return import('$lib/infrastructure/config/http-config');
}

describe('HTTP config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to /api when PUBLIC_API_URL is unset', async () => {
    const { HTTP_CONFIG } = await loadHttpConfigModule();

    expect(HTTP_CONFIG).toMatchObject({
      baseUrl: '/api',
      timeoutMs: 10_000,
      getRetry: {
        attempts: 2,
        backoffMs: 150,
        retryableStatuses: [502, 503, 504],
      },
      headers: {
        contentTypeValue: 'application/json',
        tenantIdHeader: 'X-Tenant-ID',
        authorizationHeader: 'Authorization',
        correlationIdHeader: 'X-Correlation-ID',
      },
    });
  });

  it('uses PUBLIC_API_URL when it is set', async () => {
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.com/api');
    const { HTTP_CONFIG } = await loadHttpConfigModule();

    expect(HTTP_CONFIG.baseUrl).toBe('https://api.example.com/api');
  });

  it('falls back to /api when PUBLIC_API_URL is blank', async () => {
    vi.stubEnv('PUBLIC_API_URL', '   ');
    const { HTTP_CONFIG } = await loadHttpConfigModule();

    expect(HTTP_CONFIG.baseUrl).toBe('/api');
  });

  it('merges nested overrides without dropping untouched defaults', async () => {
    const { resolveHttpConfig } = await loadHttpConfigModule();

    expect(
      resolveHttpConfig({
        timeoutMs: 2_500,
        getRetry: { attempts: 5 },
      })
    ).toMatchObject({
      timeoutMs: 2_500,
      getRetry: {
        attempts: 5,
        backoffMs: 150,
        retryableStatuses: [502, 503, 504],
      },
    });
  });
});
