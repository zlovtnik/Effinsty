import { request, type RequestOptions } from '$lib/api/client';
import { isRequestError } from '$lib/api/errors';
import { clearSessionAndRedirectToLogin } from '$lib/auth/session';
import { authStore } from '$lib/stores/auth.store';

type AuthenticatedRequestOptions = Omit<RequestOptions, 'tenantId'> & {
  tenantId: string;
};

function isUnauthorized(error: unknown): boolean {
  return isRequestError(error) && error.appError.status === 401;
}

export async function requestWithAuth<T>(
  path: string,
  options: AuthenticatedRequestOptions
): Promise<T | null> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }

    try {
      await authStore.refresh();
    } catch (refreshError) {
      await clearSessionAndRedirectToLogin('session-expired');
      throw refreshError;
    }

    try {
      return await request<T>(path, options);
    } catch (retryError) {
      if (isUnauthorized(retryError)) {
        await clearSessionAndRedirectToLogin('session-expired');
      }

      throw retryError;
    }
  }
}

export async function logoutCurrentSession(): Promise<void> {
  await authStore.logout();
}
