import { authService } from '$lib/services/auth/auth.service';

export type {
  AuthSession,
  AuthService,
  LoginRequest,
} from '$lib/services/auth/auth.service';

export function login(tenantId: string, payload: import('$lib/services/auth/auth.service').LoginRequest, correlationId?: string) {
  return authService.login(tenantId, payload, correlationId);
}

export function refresh(
  tenantId: string,
  correlationId?: string
) {
  return authService.refresh(tenantId, correlationId);
}

export function logout(
  tenantId: string,
  correlationId?: string
) {
  return authService.logout(tenantId, correlationId);
}
