import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { RequestError } from '$lib/api/errors';
import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';

vi.mock('$lib/api/auth', () => ({
  login: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

vi.mock('$lib/utils/a11y', () => ({
  announce: vi.fn(),
}));

import { login } from '$lib/api/auth';
import { goto } from '$app/navigation';
import LoginPage from '../+page.svelte';

const loginMock = vi.mocked(login);
const gotoMock = vi.mocked(goto);

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    sessionStore.reset();
    tenantStore.reset();
    window.history.replaceState({}, '', '/login');
  });

  it('shows validation errors for empty required fields', async () => {
    render(LoginPage);

    await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alerts = await screen.findAllByRole('alert');
    const visible = alerts.find(
      (alert) => !alert.classList.contains('sr-only') && alert.textContent?.includes('Please complete all required fields.')
    );
    expect(visible).toBeTruthy();
    expect(visible).toHaveTextContent('Please complete all required fields.');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits login and redirects to sanitized returnTo on success', async () => {
    loginMock.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
    });

    window.history.replaceState({}, '', '/login?returnTo=%2Fdashboard%2Fcontacts%3Fpage%3D2');
    render(LoginPage);

    await fireEvent.input(screen.getByLabelText(/Tenant ID/), {
      target: { value: 'tenant-a' },
    });
    await fireEvent.input(screen.getByLabelText(/Username/), {
      target: { value: 'alice' },
    });
    await fireEvent.input(screen.getByLabelText(/Password/), {
      target: { value: 'password' },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('tenant-a', {
        username: 'alice',
        password: 'password',
      }, expect.any(String));
    });

    await waitFor(() => {
      expect(gotoMock).toHaveBeenCalledWith('/dashboard/contacts?page=2');
    });

    expect(get(authStore).isAuthenticated).toBe(true);
    expect(get(sessionStore).refreshToken).toBe('refresh-token');
  });

  it('maps backend auth failures into visible error text', async () => {
    loginMock.mockRejectedValue(
      new RequestError({
        kind: 'auth',
        status: 401,
        code: 'unauthorized',
        message: 'Invalid credentials.',
        details: [],
        correlationId: 'corr-401',
      })
    );

    render(LoginPage);

    await fireEvent.input(screen.getByLabelText(/Tenant ID/), {
      target: { value: 'tenant-a' },
    });
    await fireEvent.input(screen.getByLabelText(/Username/), {
      target: { value: 'alice' },
    });
    await fireEvent.input(screen.getByLabelText(/Password/), {
      target: { value: 'wrong-pass' },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.');
    expect(get(authStore).isAuthenticated).toBe(false);
  });

  it('redirects authenticated users away from login route', async () => {
    window.history.replaceState({}, '', '/login?returnTo=%2Fdashboard%2Fsettings');

    authStore.completeLogin({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
    });

    render(LoginPage);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('shows reason message when redirected from invalid tenant guard', async () => {
    window.history.replaceState({}, '', '/login?reason=invalid-tenant');

    render(LoginPage);

    expect(screen.getByRole('status')).toHaveTextContent('Tenant context is invalid.');
  });
});
