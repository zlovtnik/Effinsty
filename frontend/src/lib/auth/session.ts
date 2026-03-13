import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';
import {
  buildLoginRedirectPath,
  currentPathWithQuery,
  type LoginRedirectReason,
} from '$lib/auth/navigation';

export function clearSessionState(): void {
  authStore.reset();
  sessionStore.clear();
  tenantStore.clear();
}

export async function clearSessionAndRedirectToLogin(reason?: LoginRedirectReason): Promise<void> {
  clearSessionState();

  if (typeof window === 'undefined') {
    return;
  }

  const target = reason
    ? buildLoginRedirectPath(currentPathWithQuery(), reason)
    : '/login';

  const { goto } = await import('$app/navigation');
  await goto(target);
}
