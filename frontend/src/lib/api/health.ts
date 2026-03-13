import { request, type ResponseMeta } from '$lib/api/client';
import { isRequestError } from '$lib/api/errors';

export interface HealthStatus {
  state: 'unknown' | 'healthy' | 'degraded';
  checkedAt: number | null;
  message?: string;
  correlationId?: string;
}

interface HealthResponseBody {
  status?: string;
  message?: string;
  correlationId?: string;
}

function isHealthyStatus(value: string | undefined): boolean {
  return value === 'ok' || value === 'healthy';
}

export async function checkHealth(): Promise<HealthStatus> {
  let responseMeta: ResponseMeta | null = null;

  try {
    const body = (await request<HealthResponseBody>('/health', {
      method: 'GET',
      retry: { attempts: 1, backoffMs: 0 },
      onResponseMeta: (meta) => {
        responseMeta = meta;
      },
    })) as HealthResponseBody | null;

    const normalizedStatus = body?.status?.trim().toLowerCase();
    const state = normalizedStatus && !isHealthyStatus(normalizedStatus) ? 'degraded' : 'healthy';
    const message =
      state === 'degraded'
        ? body?.message ?? `Health endpoint reported status "${body?.status ?? 'degraded'}".`
        : body?.message;

    return {
      state,
      checkedAt: Date.now(),
      message,
      correlationId: body?.correlationId ?? responseMeta?.correlationId ?? '',
    };
  } catch (error) {
    if (isRequestError(error)) {
      return {
        state: 'degraded',
        checkedAt: Date.now(),
        message:
          error.appError.message ||
          (error.appError.status
            ? `Health check failed with status ${error.appError.status}.`
            : 'Health check failed.'),
        correlationId: error.appError.correlationId ?? '',
      };
    }

    return {
      state: 'degraded',
      checkedAt: Date.now(),
      message: error instanceof Error ? error.message : 'Health check failed.',
      correlationId: '',
    };
  }
}
