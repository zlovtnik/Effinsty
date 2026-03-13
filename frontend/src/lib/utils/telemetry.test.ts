import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantStore } from '$lib/stores/tenant.store';
import {
  resetTelemetrySink,
  sanitizeTelemetryErrorDetails,
  setTelemetrySink,
  trackAction,
  trackError,
  type TelemetrySink,
  trackWebVital,
  type TelemetryEvent,
} from './telemetry';

describe('telemetry', () => {
  const sink = vi.fn<TelemetrySink>((_event: TelemetryEvent) => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    tenantStore.reset();
    window.history.replaceState({}, '', '/dashboard/contacts?page=2');
    setTelemetrySink(sink);
  });

  it('adds default route and tenant context to action events', () => {
    tenantStore.resolveTenant('tenant-a');

    trackAction('contacts_list_load', {
      status: 'success',
      details: { page: 2 },
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'action',
        name: 'contacts_list_load',
        status: 'success',
        route: '/dashboard/contacts?page=2',
        tenantId: 'tenant-a',
      })
    );
  });

  it('emits web vital events with metric details', () => {
    trackWebVital('LCP', {
      value: 1200,
      delta: 1200,
      rating: 'good',
      metricId: 'metric-1',
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'web-vital',
        name: 'LCP',
        metric: 'LCP',
        value: 1200,
        delta: 1200,
        rating: 'good',
        metricId: 'metric-1',
      })
    );
  });

  it('restores the default sink when reset', () => {
    resetTelemetrySink();

    expect(() =>
      trackAction('login', {
        status: 'start',
      })
    ).not.toThrow();
  });

  it('sanitizes error details before emission', () => {
    trackError('login_failure', {
      message: 'Unable to sign in.',
      details: [
        'Password: hunter2',
        'alice@example.com',
        'Gateway timeout while contacting upstream.',
      ],
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        details: [
          '[redacted sensitive detail]',
          '[redacted sensitive detail]',
          'Gateway timeout while contacting upstream.',
        ],
      })
    );
  });

  it('catches rejected async sinks', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    setTelemetrySink(() => Promise.reject(new Error('sink failed')));
    trackAction('login', { status: 'start' });
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith('[telemetry]', 'sink failure', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('sanitizes and truncates detail arrays through the helper', () => {
    expect(
      sanitizeTelemetryErrorDetails([
        'safe detail',
        '/Users/rcs/private/secret.txt',
        'x'.repeat(200),
        'a',
        'b',
        'c',
      ])
    ).toEqual([
      'safe detail',
      '[redacted sensitive detail]',
      `${'x'.repeat(157)}...`,
      'a',
      'b',
      'Additional error details omitted.',
    ]);
  });
});
