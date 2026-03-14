import { RequestError, toNetworkError } from '$lib/api/errors';
import {
  defaultHttpClient,
  type HttpClient,
} from '$lib/infrastructure/http/client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthSession {
  expiresAt: string;
}

export interface AuthService {
  login(
    tenantId: string,
    payload: LoginRequest,
    correlationId?: string
  ): Promise<AuthSession>;
  refresh(
    tenantId: string,
    correlationId?: string
  ): Promise<AuthSession>;
  logout(
    tenantId: string,
    correlationId?: string
  ): Promise<{ success: boolean }>;
  isSessionExpired(expiresAt: string, leewayMs?: number): boolean;
}

export interface AuthServiceDependencies {
  httpClient?: HttpClient;
}

function requireBody<T>(payload: T | null, endpoint: string): T {
  if (payload === null) {
    throw new RequestError(toNetworkError(`Empty response body from ${endpoint}.`));
  }

  return payload;
}

export function createAuthService(
  dependencies: AuthServiceDependencies = {}
): AuthService {
  const httpClient = dependencies.httpClient ?? defaultHttpClient;

  return {
    async login(tenantId, payload, correlationId) {
      return requireBody(
        await httpClient.post<AuthSession>('/auth/login', {
          tenantId,
          body: payload,
          correlationId,
        }),
        '/auth/login'
      );
    },
    async refresh(tenantId, correlationId) {
      return requireBody(
        await httpClient.post<AuthSession>('/auth/refresh', {
          tenantId,
          correlationId,
        }),
        '/auth/refresh'
      );
    },
    async logout(tenantId, correlationId) {
      return requireBody(
        await httpClient.post<{ success: boolean }>('/auth/logout', {
          tenantId,
          correlationId,
        }),
        '/auth/logout'
      );
    },
    isSessionExpired(expiresAt, leewayMs = 0) {
      const expiryTime = Date.parse(expiresAt);
      if (!Number.isFinite(expiryTime)) {
        return true;
      }

      return expiryTime <= Date.now() + Math.max(leewayMs, 0);
    },
  };
}

export const authService = createAuthService();
