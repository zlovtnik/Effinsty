export type LoginRedirectReason = 'invalid-tenant' | 'session-expired';

export const DEFAULT_POST_LOGIN_PATH = '/dashboard';

export function sanitizeReturnTo(rawReturnTo: string | null | undefined): string {
  if (!rawReturnTo) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (!rawReturnTo.startsWith('/') || rawReturnTo.startsWith('//') || rawReturnTo === '/login' || rawReturnTo.startsWith('/login?') || rawReturnTo.startsWith('/login/')) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return rawReturnTo;
}

export function buildLoginRedirectPath(returnToPath: string, reason?: LoginRedirectReason): string {
  const params = new URLSearchParams();
  params.set('returnTo', sanitizeReturnTo(returnToPath));

  if (reason) {
    params.set('reason', reason);
  }

  return `/login?${params.toString()}`;
}

export function extractReturnToFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return sanitizeReturnTo(params.get('returnTo'));
}

export function extractReasonFromSearch(search: string): LoginRedirectReason | null {
  const params = new URLSearchParams(search);
  const value = params.get('reason');

  if (value === 'invalid-tenant' || value === 'session-expired') {
    return value;
  }

  return null;
}

export function currentPathWithQuery(): string {
  if (typeof globalThis.location === 'undefined') {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return `${globalThis.location.pathname}${globalThis.location.search}`;
}
