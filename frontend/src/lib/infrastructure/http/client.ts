import {
  RequestError,
  toCancellationError,
  toNetworkError,
  toTimeoutError,
} from '$lib/api/errors';
import {
  resolveHttpConfig,
  type HttpConfigOverrides,
} from '$lib/infrastructure/config/http-config';
import { IdGenerator } from '$lib/infrastructure/crypto/id-generator';
import { mapApiError } from '$lib/services/error/error-mapper';

export interface RetryOptions {
  attempts?: number;
  backoffMs?: number;
  retryableStatuses?: number[];
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
  correlationId?: string;
  timeoutMs?: number;
  retry?: RetryOptions;
  baseUrl?: string;
  credentials?: RequestCredentials;
  onResponseMeta?: (meta: ResponseMeta) => void;
}

export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T | null>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T | null>;
  post<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T | null>;
  put<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T | null>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T | null>;
}

const CONTENT_TYPE_HEADER = 'Content-Type';

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

function buildRequestHeaders(
  options: RequestOptions,
  correlationId: string,
  config: ReturnType<typeof resolveHttpConfig>
): Headers {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has(CONTENT_TYPE_HEADER) && options.body !== undefined && !isBodyInit(options.body)) {
    headers.set(CONTENT_TYPE_HEADER, config.headers.contentTypeValue);
  }

  if (options.tenantId) {
    headers.set(config.headers.tenantIdHeader, options.tenantId);
  }

  if (!headers.has(config.headers.correlationIdHeader)) {
    headers.set(config.headers.correlationIdHeader, correlationId);
  }

  return headers;
}

async function parseBody<T>(response: Response, correlationId: string): Promise<T | null> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get(CONTENT_TYPE_HEADER) ?? '';
  let parsedBody: T | null = null;

  if (contentType.includes('application/json')) {
    try {
      parsedBody = (await response.json()) as T;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new RequestError(
        toNetworkError(`Invalid JSON response: ${details}`, correlationId)
      );
    }
  }

  return parsedBody;
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

function toRequestUrl(path: string, baseUrl: string): string {
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL(`${baseUrl}${path}`, origin).toString();
}

function getBackoffDelayMs(backoffMs: number, attempt: number): number {
  return backoffMs * Math.pow(2, attempt - 1);
}

function linkAbortSignal(
  controller: AbortController,
  signal?: AbortSignal | null
): () => void {
  if (!signal) {
    return () => {};
  }

  if (signal.aborted) {
    controller.abort();
    return () => {};
  }

  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });

  return () => signal.removeEventListener('abort', onAbort);
}

export function createHttpClient(
  configOverrides: HttpConfigOverrides = {}
): HttpClient {
  const config = resolveHttpConfig(configOverrides);

  async function request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const method = toMethod(options.method);
    const correlationId = options.correlationId ?? IdGenerator.correlationId();
    const timeoutMs = options.timeoutMs ?? config.timeoutMs;
    const attempts =
      method === 'GET'
        ? Math.max(options.retry?.attempts ?? config.getRetry.attempts, 1)
        : 1;
    const backoffMs = Math.max(
      options.retry?.backoffMs ?? config.getRetry.backoffMs,
      0
    );
    const retryableStatuses =
      options.retry?.retryableStatuses ?? config.getRetry.retryableStatuses;

    const body =
      options.body === undefined
        ? undefined
        : isBodyInit(options.body)
          ? options.body
          : JSON.stringify(options.body);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      let timeoutTriggered = false;
      let unlinkAbortSignal = () => {};

      try {
        const headers = buildRequestHeaders(options, correlationId, config);
        const abortController = new AbortController();
        unlinkAbortSignal = linkAbortSignal(abortController, options.signal);

        if (timeoutMs > 0) {
          timeoutHandle = setTimeout(() => {
            timeoutTriggered = true;
            abortController.abort();
          }, timeoutMs);
        }

        const response = await fetch(
          toRequestUrl(path, options.baseUrl ?? config.baseUrl),
          {
            ...options,
            method,
            headers,
            credentials: options.credentials ?? 'include',
            body,
            signal: abortController.signal,
          }
        );

        const responseCorrelationId =
          response.headers.get(config.headers.correlationIdHeader) ?? correlationId;
        const parsedBody = await parseBody<T>(response, responseCorrelationId);

        options.onResponseMeta?.({
          correlationId: responseCorrelationId,
          status: response.status,
          attempt,
        });

        if (!response.ok) {
          if (
            method === 'GET' &&
            attempt < attempts &&
            retryableStatuses.includes(response.status)
          ) {
            await sleep(getBackoffDelayMs(backoffMs, attempt));
            continue;
          }

          throw new RequestError(
            mapApiError(response.status, parsedBody, responseCorrelationId)
          );
        }

        return parsedBody;
      } catch (error) {
        if (isAbortError(error)) {
          if (options.signal?.aborted && !timeoutTriggered) {
            throw new RequestError(
              toCancellationError(undefined, correlationId)
            );
          }

          const timeoutError = new RequestError(
            toTimeoutError(undefined, correlationId)
          );

          if (method === 'GET' && attempt < attempts) {
            await sleep(getBackoffDelayMs(backoffMs, attempt));
            continue;
          }

          throw timeoutError;
        }

        if (error instanceof RequestError) {
          if (
            error.appError.kind === 'timeout' &&
            method === 'GET' &&
            attempt < attempts
          ) {
            await sleep(getBackoffDelayMs(backoffMs, attempt));
            continue;
          }

          throw error;
        }

        const networkError = new RequestError(
          toNetworkError(
            error instanceof Error ? error.message : 'Network request failed.',
            correlationId
          )
        );

        if (method === 'GET' && attempt < attempts) {
          await sleep(getBackoffDelayMs(backoffMs, attempt));
          continue;
        }

        throw networkError;
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        unlinkAbortSignal();
      }
    }

    throw new RequestError(
      toNetworkError('Exhausted all retry attempts.', correlationId)
    );
  }

  return {
    request,
    get<T>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'GET' });
    },
    post<T>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'POST' });
    },
    put<T>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'PUT' });
    },
    delete<T>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'DELETE' });
    },
  };
}

export const defaultHttpClient = createHttpClient();

export function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T | null> {
  return defaultHttpClient.request<T>(path, options);
}
