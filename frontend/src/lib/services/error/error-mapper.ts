import type {
  ApiErrorResponse,
  AppError,
  AppErrorKind,
} from '$lib/services/error/error-types';

export function statusToAppErrorKind(status: number): AppErrorKind {
  switch (status) {
    case 400:
      return 'validation';
    case 401:
      return 'auth';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    default:
      return 'unexpected';
  }
}

export function createConfigurationError(
  message: string,
  correlationId?: string
): AppError {
  return {
    kind: 'unexpected',
    code: 'client_configuration',
    message,
    details: [],
    correlationId,
  };
}

export function createNetworkError(
  message = 'Network request failed.',
  correlationId?: string
): AppError {
  return {
    kind: 'network',
    code: 'network_error',
    message,
    details: [],
    correlationId,
  };
}

export function createTimeoutError(
  message = 'The request timed out.',
  correlationId?: string
): AppError {
  return {
    kind: 'timeout',
    code: 'timeout',
    message,
    details: [],
    correlationId,
  };
}

export function createCancellationError(
  message = 'The request was canceled.',
  correlationId?: string
): AppError {
  return {
    kind: 'canceled',
    code: 'request_canceled',
    message,
    details: [],
    correlationId,
  };
}

export function mapApiError(
  status: number,
  body: unknown,
  fallbackCorrelationId?: string
): AppError {
  const fallback: AppError = {
    kind: statusToAppErrorKind(status),
    status,
    code: 'unexpected_error',
    message: 'An unexpected error occurred.',
    details: [],
    correlationId: fallbackCorrelationId,
  };

  if (!body || typeof body !== 'object') {
    return fallback;
  }

  const parsed = body as Partial<ApiErrorResponse>;

  return {
    kind: statusToAppErrorKind(status),
    status,
    code: parsed.code ?? 'unexpected_error',
    message: parsed.message ?? 'An unexpected error occurred.',
    details: Array.isArray(parsed.details) ? parsed.details : [],
    correlationId: parsed.correlationId ?? fallbackCorrelationId ?? '',
  };
}
