// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Alert from '../Alert.svelte';

describe('Alert', () => {
  it('renders danger alerts with details and correlation ids', () => {
    render(Alert, {
      props: {
        title: 'Unable to save',
        message: 'Something failed.',
        details: ['Email is invalid.', 'Retry later.'],
        correlationId: 'corr-alert',
        tone: 'danger',
        role: 'alert',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save');
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed.');
    expect(screen.getByText('Email is invalid.')).toBeInTheDocument();
    expect(screen.getByText('Retry later.')).toBeInTheDocument();
    expect(screen.getByText('corr-alert')).toBeInTheDocument();
  });

  it('renders info alerts as status regions', () => {
    render(Alert, {
      props: {
        message: 'Session expired. Sign in again.',
        tone: 'info',
        role: 'status',
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Session expired. Sign in again.');
  });
});
