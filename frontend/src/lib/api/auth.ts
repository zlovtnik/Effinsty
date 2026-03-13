import { request } from '$lib/api/client';
import { RequestError, toNetworkError } from '$lib/api/errors';

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

function requireBody<T>(payload: T | null, endpoint: string): T {
  if (payload === null) {
    throw new RequestError(toNetworkError(`Empty response body from ${endpoint}.`));
  }

  return payload;
}

export function login(tenantId: string, payload: LoginRequest, correlationId?: string) {
  return request<AuthTokens>('/auth/login', {
    method: 'POST',
    body: payload,
    tenantId,
    correlationId,
  }).then((response) => requireBody(response, '/auth/login'));
}

export function refresh(tenantId: string, payload: RefreshRequest, correlationId?: string) {
  return request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: payload,
    tenantId,
    correlationId,
  }).then((response) => requireBody(response, '/auth/refresh'));
}

export function logout(
  tenantId: string,
  payload: RefreshRequest,
  accessToken: string,
  correlationId?: string
) {
  return request<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    body: payload,
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, '/auth/logout'));
}
