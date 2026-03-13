import { authService } from '$lib/services/auth/auth.service';

export type {
  AuthService,
  AuthTokens,
  LoginRequest,
  RefreshRequest,
} from '$lib/services/auth/auth.service';

export function login(tenantId: string, payload: import('$lib/services/auth/auth.service').LoginRequest, correlationId?: string) {
  return authService.login(tenantId, payload, correlationId);
}

export function refresh(
  tenantId: string,
  payload: import('$lib/services/auth/auth.service').RefreshRequest,
  correlationId?: string
) {
  return authService.refresh(tenantId, payload, correlationId);
}

export function logout(
  tenantId: string,
  payload: import('$lib/services/auth/auth.service').RefreshRequest,
  accessToken: string,
  correlationId?: string
) {
  return authService.logout(tenantId, payload, accessToken, correlationId);
}
