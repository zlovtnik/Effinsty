// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

vi.mock('$lib/api/authenticated', () => ({
  logoutCurrentSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/stores/health.store', () => ({
  healthStore: {
    subscribe: vi.fn((run: (value: { state: string; checkedAt: number | null; message: string; correlationId: string }) => void) => {
      run({ state: 'healthy', checkedAt: 123, message: '', correlationId: '' });
      return () => {};
    }),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    reset: vi.fn(),
  },
}));

import { logoutCurrentSession } from '$lib/api/authenticated';
import DashboardLayout from '../+layout.svelte';

const gotoMock = vi.mocked(goto);
const logoutCurrentSessionMock = vi.mocked(logoutCurrentSession);

describe('dashboard layout guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    sessionStore.reset();
    tenantStore.reset();
  });

  it('redirects unauthenticated users to login with returnTo', async () => {
    window.history.replaceState({}, '', '/dashboard/contacts');

    render(DashboardLayout);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenCalledWith('/login?returnTo=%2Fdashboard%2Fcontacts');
    });
  });

  it('redirects authenticated users with invalid tenant context', async () => {
    window.history.replaceState({}, '', '/dashboard/settings');
    authStore.setSession('access-token', '2026-03-13T10:00:00Z');
    tenantStore.setTenant('tenant-a');

    render(DashboardLayout);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenCalledWith(
        '/login?returnTo=%2Fdashboard%2Fsettings&reason=invalid-tenant'
      );
    });
  });

  it('signs out and redirects to login from dashboard shell', async () => {
    window.history.replaceState({}, '', '/dashboard');
    authStore.setSession('access-token', '2026-03-13T10:00:00Z');
    sessionStore.setRefreshToken('refresh-token');
    tenantStore.resolveTenant('tenant-a');

    render(DashboardLayout);
    await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(logoutCurrentSessionMock).toHaveBeenCalledTimes(1);
      expect(gotoMock).toHaveBeenCalledWith('/login');
    });
  });
});
