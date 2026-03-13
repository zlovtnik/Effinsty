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
