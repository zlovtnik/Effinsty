export interface ApiErrorResponse {
  code: string;
  message: string;
  details: string[];
  correlationId: string;
}

export type AppErrorKind =
  | 'validation'
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'network'
  | 'canceled'
  | 'timeout'
  | 'unexpected';

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  code: string;
  message: string;
  details: string[];
  correlationId?: string;
}

export class RequestError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.message);
    this.name = 'RequestError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: string[] = [],
    public readonly correlationId = ''
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError;
}

function statusToKind(status: number): AppErrorKind {
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

export function toConfigurationError(message: string): AppError {
  return {
    kind: 'unexpected',
    code: 'client_configuration',
    message,
    details: [],
  };
}

export function toNetworkError(message = 'Network request failed.'): AppError {
  return {
    kind: 'network',
    code: 'network_error',
    message,
    details: [],
  };
}

export function toTimeoutError(message = 'The request timed out.'): AppError {
  return {
    kind: 'timeout',
    code: 'timeout',
    message,
    details: [],
  };
}

export function toCancellationError(message = 'The request was canceled.'): AppError {
  return {
    kind: 'canceled',
    code: 'request_canceled',
    message,
    details: [],
  };
}

export function toAppError(status: number, body: unknown, fallbackCorrelationId?: string): AppError {
  const fallback: AppError = {
    kind: statusToKind(status),
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
    kind: statusToKind(status),
    status,
    code: parsed.code ?? 'unexpected_error',
    message: parsed.message ?? 'An unexpected error occurred.',
    details: Array.isArray(parsed.details) ? parsed.details : [],
    correlationId: parsed.correlationId ?? fallbackCorrelationId ?? '',
  };
}

export function toApiError(status: number, body: unknown): ApiError {
  const appError = toAppError(status, body);

  return new ApiError(
    status,
    appError.code,
    appError.message,
    appError.details,
    appError.correlationId ?? ''
  );
}

export function userMessageFromError(error: unknown): string {
  if (isRequestError(error)) {
    return error.appError.message;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
