import { describe, expect, it } from 'vitest';
import {
  HTTP_CONFIG,
  resolveHttpConfig,
} from '$lib/infrastructure/config/http-config';

describe('HTTP config', () => {
  it('exposes stable defaults for timeout, retry, and headers', () => {
    expect(HTTP_CONFIG).toMatchObject({
      baseUrl: '/api',
      timeoutMs: 10_000,
      getRetry: {
        attempts: 2,
        backoffMs: 150,
        retryableStatuses: [502, 503, 504],
      },
      headers: {
        contentType: 'application/json',
        tenantId: 'X-Tenant-ID',
        authorization: 'Authorization',
        correlationId: 'X-Correlation-ID',
      },
    });
  });

  it('merges nested overrides without dropping untouched defaults', () => {
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
