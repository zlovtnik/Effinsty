import {
  createCancellationError,
  createConfigurationError,
  createNetworkError,
  createTimeoutError,
  mapApiError,
} from '$lib/services/error/error-mapper';
import {
  ApiError,
  RequestError,
  isRequestError,
  type ApiErrorResponse,
  type AppError,
  type AppErrorKind,
} from '$lib/services/error/error-types';
import { presentError } from '$lib/services/error/error-presenter';

export type { ApiErrorResponse, AppError, AppErrorKind };
export { ApiError, RequestError, isRequestError };

export function toConfigurationError(
  message: string,
  correlationId?: string
): AppError {
  return createConfigurationError(message, correlationId);
}

export function toNetworkError(
  message = 'Network request failed.',
  correlationId?: string
): AppError {
  return createNetworkError(message, correlationId);
}

export function toTimeoutError(
  message = 'The request timed out.',
  correlationId?: string
): AppError {
  return createTimeoutError(message, correlationId);
}

export function toCancellationError(
  message = 'The request was canceled.',
  correlationId?: string
): AppError {
  return createCancellationError(message, correlationId);
}

export function toAppError(status: number, body: unknown, fallbackCorrelationId?: string): AppError {
  return mapApiError(status, body, fallbackCorrelationId);
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
  return presentError(error).message;
}
