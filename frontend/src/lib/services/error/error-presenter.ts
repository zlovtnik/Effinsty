import {
  ApiError,
  isRequestError,
  type AppErrorKind,
} from '$lib/services/error/error-types';

export interface PresentedError {
  kind: AppErrorKind;
  message: string;
  details: string[];
  correlationId: string;
}

export interface PresentErrorOptions {
  fallbackMessage?: string;
  fallbackCorrelationId?: string;
}

export const SESSION_CONTEXT_ERROR_MESSAGE =
  'Session context is missing. Please sign in again.';

export function presentError(
  error: unknown,
  options: PresentErrorOptions = {}
): PresentedError {
  const fallbackMessage =
    options.fallbackMessage ?? 'An unexpected error occurred.';
  const fallbackCorrelationId = options.fallbackCorrelationId ?? '';

  if (isRequestError(error)) {
    return {
      kind: error.appError.kind,
      message: error.appError.message,
      details: error.appError.details,
      correlationId: error.appError.correlationId ?? fallbackCorrelationId,
    };
  }

  if (error instanceof ApiError) {
    return {
      kind: 'unexpected',
      message: error.message,
      details: error.details,
      correlationId: error.correlationId || fallbackCorrelationId,
    };
  }

  if (error instanceof Error) {
    return {
      kind: 'unexpected',
      message: error.message || fallbackMessage,
      details: [],
      correlationId: fallbackCorrelationId,
    };
  }

  return {
    kind: 'unexpected',
    message: fallbackMessage,
    details: [],
    correlationId: fallbackCorrelationId,
  };
}

export function presentSessionContextError(): PresentedError {
  return {
    kind: 'unexpected',
    message: SESSION_CONTEXT_ERROR_MESSAGE,
    details: [],
    correlationId: '',
  };
}
