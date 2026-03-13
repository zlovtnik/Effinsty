import { get } from 'svelte/store';
import { logout, refresh } from '$lib/api/auth';
import { request, type RequestOptions } from '$lib/api/client';
import { isRequestError, RequestError, toConfigurationError } from '$lib/api/errors';
import { clearSessionAndRedirectToLogin, clearSessionState } from '$lib/auth/session';
import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';

type AuthenticatedRequestOptions = Omit<RequestOptions, 'tenantId' | 'accessToken'> & {
  tenantId: string;
  accessToken: string;
};

let refreshInFlight: Promise<string> | null = null;

function isUnauthorized(error: unknown): boolean {
  return isRequestError(error) && error.appError.status === 401;
}

async function refreshAccessToken(tenantId: string): Promise<string> {
  const activeSession = get(sessionStore);
  const { refreshToken } = activeSession;

  if (!refreshToken) {
    throw new RequestError(
      toConfigurationError('Cannot refresh session: refresh token is not available in memory.')
    );
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const next = await refresh(tenantId, { refreshToken });
      authStore.setSession(next.accessToken, next.expiresAt);
      sessionStore.setRefreshToken(next.refreshToken);
      tenantStore.resolveTenant(tenantId);
      return next.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
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

    let refreshedAccessToken: string;

    try {
      refreshedAccessToken = await refreshAccessToken(options.tenantId);
    } catch (refreshError) {
      await clearSessionAndRedirectToLogin('session-expired');
      throw refreshError;
    }

    try {
      return await request<T>(path, { ...options, accessToken: refreshedAccessToken });
    } catch (retryError) {
      if (isUnauthorized(retryError)) {
        await clearSessionAndRedirectToLogin('session-expired');
      }

      throw retryError;
    }
  }
}

export async function logoutCurrentSession(): Promise<void> {
  const authState = get(authStore);
  const tenantState = get(tenantStore);
  const sessionState = get(sessionStore);

  try {
    if (tenantState.tenantId && authState.accessToken && sessionState.refreshToken) {
      await logout(
        tenantState.tenantId,
        { refreshToken: sessionState.refreshToken },
        authState.accessToken
      );
    }
  } finally {
    clearSessionState();
  }
}
