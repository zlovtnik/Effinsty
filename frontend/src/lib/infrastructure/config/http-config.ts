export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
  retryableStatuses: number[];
}

export interface HttpHeaderConfig {
  contentType: string;
  tenantId: string;
  authorization: string;
  correlationId: string;
}

export interface HttpConfig {
  baseUrl: string;
  timeoutMs: number;
  getRetry: RetryPolicy;
  headers: HttpHeaderConfig;
}

export type HttpConfigOverrides = Partial<Omit<HttpConfig, 'getRetry' | 'headers'>> & {
  getRetry?: Partial<RetryPolicy>;
  headers?: Partial<HttpHeaderConfig>;
};

export const HTTP_CONFIG: HttpConfig = {
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
};

export function resolveHttpConfig(overrides: HttpConfigOverrides = {}): HttpConfig {
  return {
    baseUrl: overrides.baseUrl ?? HTTP_CONFIG.baseUrl,
    timeoutMs: overrides.timeoutMs ?? HTTP_CONFIG.timeoutMs,
    getRetry: {
      attempts: overrides.getRetry?.attempts ?? HTTP_CONFIG.getRetry.attempts,
      backoffMs: overrides.getRetry?.backoffMs ?? HTTP_CONFIG.getRetry.backoffMs,
      retryableStatuses:
        overrides.getRetry?.retryableStatuses ?? [...HTTP_CONFIG.getRetry.retryableStatuses],
    },
    headers: {
      contentType: overrides.headers?.contentType ?? HTTP_CONFIG.headers.contentType,
      tenantId: overrides.headers?.tenantId ?? HTTP_CONFIG.headers.tenantId,
      authorization:
        overrides.headers?.authorization ?? HTTP_CONFIG.headers.authorization,
      correlationId: overrides.headers?.correlationId ?? HTTP_CONFIG.headers.correlationId,
    },
  };
}
