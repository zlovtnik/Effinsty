import { RequestError, toNetworkError } from '$lib/api/errors';
import {
  defaultHttpClient,
  type HttpClient,
} from '$lib/infrastructure/http/client';
import {
  sessionStorageService,
  type SessionStorage,
} from '$lib/infrastructure/storage/session-storage';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthService {
  login(
    tenantId: string,
    payload: LoginRequest,
    correlationId?: string
  ): Promise<AuthTokens>;
  refresh(
    tenantId: string,
    payload: RefreshRequest,
    correlationId?: string
  ): Promise<AuthTokens>;
  logout(
    tenantId: string,
    payload: RefreshRequest,
    accessToken: string,
    correlationId?: string
  ): Promise<{ success: boolean }>;
  isTokenExpired(expiresAt: string, leewayMs?: number): boolean;
  getAuthHeader(accessToken: string): Record<string, string>;
}

export interface AuthServiceDependencies {
  httpClient?: HttpClient;
  sessionStorage?: SessionStorage;
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
  const sessionStorage = dependencies.sessionStorage ?? sessionStorageService;

  return {
    async login(tenantId, payload, correlationId) {
      const tokens = requireBody(
        await httpClient.post<AuthTokens>('/auth/login', {
          tenantId,
          body: payload,
          correlationId,
        }),
        '/auth/login'
      );
      sessionStorage.setTokens(tokens);
      return tokens;
    },
    async refresh(tenantId, payload, correlationId) {
      const tokens = requireBody(
        await httpClient.post<AuthTokens>('/auth/refresh', {
          tenantId,
          body: payload,
          correlationId,
        }),
        '/auth/refresh'
      );
      sessionStorage.setTokens(tokens);
      return tokens;
    },
    async logout(tenantId, payload, accessToken, correlationId) {
      const response = requireBody(
        await httpClient.post<{ success: boolean }>('/auth/logout', {
          tenantId,
          accessToken,
          body: payload,
          correlationId,
        }),
        '/auth/logout'
      );
      sessionStorage.clear();
      return response;
    },
    isTokenExpired(expiresAt, leewayMs = 0) {
      const expiryTime = Date.parse(expiresAt);
      if (!Number.isFinite(expiryTime)) {
        return true;
      }

      return expiryTime <= Date.now() + Math.max(leewayMs, 0);
    },
    getAuthHeader(accessToken) {
      return {
        Authorization: `Bearer ${accessToken}`,
      };
    },
  };
}

export const authService = createAuthService();
