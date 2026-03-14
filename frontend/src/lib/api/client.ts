import { RequestError, toConfigurationError } from '$lib/api/errors';
import { request as infrastructureRequest, type RequestOptions } from '$lib/infrastructure/http/client';

export type { RequestOptions, ResponseMeta, RetryOptions } from '$lib/infrastructure/http/client';

function isTenantScopedPath(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || path.startsWith('/auth/logout') || path.startsWith('/contacts');
}

function validateHeaderPolicy(path: string, options: RequestOptions): void {
  if (isTenantScopedPath(path) && !options.tenantId) {
    throw new RequestError(
      toConfigurationError(`Missing required tenant context for tenant-scoped path "${path}".`)
    );
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  validateHeaderPolicy(path, options);
  return infrastructureRequest<T>(path, options);
}
