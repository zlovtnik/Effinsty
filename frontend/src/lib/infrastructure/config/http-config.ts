export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
  retryableStatuses: number[];
}

export interface HttpHeaderConfig {
  contentTypeValue: string;
  tenantIdHeader: string;
  authorizationHeader: string;
  correlationIdHeader: string;
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

function resolveBaseUrlFromEnv(): string {
  const configuredBaseUrl = import.meta.env.PUBLIC_API_URL?.trim();
  return configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : '/api';
}

export const HTTP_CONFIG: HttpConfig = {
  baseUrl: resolveBaseUrlFromEnv(),
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
      contentTypeValue:
        overrides.headers?.contentTypeValue ?? HTTP_CONFIG.headers.contentTypeValue,
      tenantIdHeader:
        overrides.headers?.tenantIdHeader ?? HTTP_CONFIG.headers.tenantIdHeader,
      authorizationHeader:
        overrides.headers?.authorizationHeader ?? HTTP_CONFIG.headers.authorizationHeader,
      correlationIdHeader:
        overrides.headers?.correlationIdHeader ?? HTTP_CONFIG.headers.correlationIdHeader,
    },
  };
}
