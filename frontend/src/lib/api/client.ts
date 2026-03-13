import {
  toCancellationError,
  RequestError,
  toAppError,
  toConfigurationError,
  toNetworkError,
  toTimeoutError,
} from '$lib/api/errors';

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_GET_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BACKOFF_MS = 150;

export interface RetryOptions {
  attempts?: number;
  backoffMs?: number;
}

export interface ResponseMeta {
  correlationId: string;
  status: number;
  attempt: number;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  method?: string;
  body?: unknown;
  tenantId?: string;
  accessToken?: string;
  correlationId?: string;
  timeoutMs?: number;
  retry?: RetryOptions;
  baseUrl?: string;
  credentials?: RequestCredentials;
  onResponseMeta?: (meta: ResponseMeta) => void;
}

function generateCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function isTenantScopedPath(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || path.startsWith('/auth/logout') || path.startsWith('/contacts');
}

function requiresAuthorization(path: string): boolean {
  return path.startsWith('/auth/logout') || path.startsWith('/contacts');
}

function shouldRetryStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function toMethod(value?: string): string {
  return value?.toUpperCase() ?? 'GET';
}

function isReadableStream(value: unknown): value is ReadableStream {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    isReadableStream(value)
  );
}

function buildRequestHeaders(options: RequestOptions, correlationId: string): Headers {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type') && options.body !== undefined && !isBodyInit(options.body)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.tenantId) {
    headers.set('X-Tenant-ID', options.tenantId);
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  if (!headers.has('X-Correlation-ID')) {
    headers.set('X-Correlation-ID', correlationId);
  }

  return headers;
}

async function parseBody<T>(response: Response): Promise<T | null> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  let parsedBody: T | null = null;

  if (contentType.includes('application/json')) {
    try {
      parsedBody = (await response.json()) as T;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new RequestError(toNetworkError(`Invalid JSON response: ${details}`));
    }
  }

  return parsedBody;
}

function validateHeaderPolicy(path: string, options: RequestOptions): void {
  if (isTenantScopedPath(path) && !options.tenantId) {
    throw new RequestError(
      toConfigurationError(`Missing required tenant context for tenant-scoped path "${path}".`)
    );
  }

  if (requiresAuthorization(path) && !options.accessToken) {
    throw new RequestError(
      toConfigurationError(`Missing bearer token for protected path "${path}".`)
    );
  }
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  return error instanceof Error && error.name === 'AbortError';
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function toRequestUrl(path: string, baseUrl?: string): string {
  const requestBase = baseUrl ?? API_BASE_URL;
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL(`${requestBase}${path}`, origin).toString();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  validateHeaderPolicy(path, options);

  const method = toMethod(options.method);
  const correlationId = options.correlationId ?? generateCorrelationId();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts =
    method === 'GET'
      ? Math.max(options.retry?.attempts ?? DEFAULT_GET_RETRY_ATTEMPTS, 1)
      : 1;
  const backoffMs = Math.max(options.retry?.backoffMs ?? DEFAULT_RETRY_BACKOFF_MS, 0);

  const body =
    options.body === undefined
      ? undefined
      : isBodyInit(options.body)
        ? options.body
      : JSON.stringify(options.body);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeoutController = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let abortRelay: (() => void) | undefined;

    if (options.signal) {
      if (options.signal.aborted) {
        timeoutController.abort();
      } else {
        abortRelay = () => timeoutController.abort();
        options.signal.addEventListener('abort', abortRelay, { once: true });
      }
    }

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
    }

    try {
      const headers = buildRequestHeaders(options, correlationId);
      const response = await fetch(toRequestUrl(path, options.baseUrl), {
        ...options,
        method,
        headers,
        credentials: options.credentials ?? 'include',
        body,
        signal: timeoutController.signal,
      });

      const responseCorrelationId =
        response.headers.get('X-Correlation-ID') ?? correlationId;
      const parsedBody = await parseBody<T>(response);

      options.onResponseMeta?.({
        correlationId: responseCorrelationId,
        status: response.status,
        attempt,
      });

      if (!response.ok) {
        if (method === 'GET' && attempt < attempts && shouldRetryStatus(response.status)) {
          await sleep(backoffMs * attempt);
          continue;
        }

        throw new RequestError(toAppError(response.status, parsedBody, responseCorrelationId));
      }

      return parsedBody;
    } catch (error) {
      if (isAbortError(error)) {
        if (options.signal?.aborted) {
          throw new RequestError(toCancellationError());
        }

        const timeoutError = new RequestError(toTimeoutError());

        if (method === 'GET' && attempt < attempts) {
          await sleep(backoffMs * attempt);
          continue;
        }

        throw timeoutError;
      }

      if (error instanceof RequestError) {
        throw error;
      }

      const networkError = new RequestError(
        toNetworkError(error instanceof Error ? error.message : 'Network request failed.')
      );

      if (method === 'GET' && attempt < attempts) {
        await sleep(backoffMs * attempt);
        continue;
      }

      throw networkError;
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }

      if (options.signal && abortRelay) {
        options.signal.removeEventListener('abort', abortRelay);
      }
    }
  }

  throw new RequestError(toNetworkError());
}
