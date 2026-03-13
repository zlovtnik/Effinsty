// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import LoginForm from '../LoginForm.svelte';
import type { LoginFieldView } from '$lib/auth/login-view';

function buildFields(): LoginFieldView[] {
  return [
    {
      key: 'tenantId',
      id: 'tenant-id',
      name: 'tenant-id',
      label: 'Tenant ID',
      type: 'text',
      autocomplete: 'organization',
      value: '',
      error: '',
      errorId: 'tenant-id-error',
      delayIndex: 1,
    },
    {
      key: 'username',
      id: 'username',
      name: 'username',
      label: 'Username',
      type: 'text',
      autocomplete: 'username',
      value: '',
      error: '',
      errorId: 'username-error',
      delayIndex: 2,
    },
    {
      key: 'password',
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'current-password',
      value: '',
      error: 'Password is required.',
      errorId: 'password-error',
      delayIndex: 3,
    },
  ];
}

describe('LoginForm', () => {
  it('renders fields and forwards field changes and submit actions', async () => {
    const onFieldChange = vi.fn();
    const onSubmit = vi.fn();
    const { container } = render(LoginForm, {
      props: {
        fields: buildFields(),
        onFieldChange,
        onSubmit,
      },
    });

    expect(screen.getByLabelText(/Tenant ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText(/Tenant ID/i), {
      target: { value: 'tenant-a' },
    });
    await fireEvent.submit(container.querySelector('form')!);

    expect(onFieldChange).toHaveBeenCalledWith('tenantId', 'tenant-a');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders busy state, route message, and alert feedback', () => {
    render(LoginForm, {
      props: {
        fields: buildFields(),
        routeMessage: 'Your session expired. Sign in again to continue.',
        submitLabel: 'Signing in...',
        isBusy: true,
        showAlert: true,
        alertView: {
          message: 'Please complete all required fields.',
          details: ['Password is required.'],
          correlationId: 'corr-login',
        },
        onFieldChange: vi.fn(),
        onSubmit: vi.fn(),
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Your session expired. Sign in again to continue.');
    const alerts = screen.getAllByRole('alert');
    const formAlert = alerts.find((alert) => alert.textContent?.includes('Please complete all required fields.'));
    expect(formAlert).toBeTruthy();
    expect(screen.getAllByText('Password is required.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Signing in...' })).toHaveAttribute('aria-busy', 'true');
  });
});
