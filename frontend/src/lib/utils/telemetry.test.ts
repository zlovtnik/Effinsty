import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantStore } from '$lib/stores/tenant.store';
import {
  resetTelemetrySink,
  setTelemetrySink,
  trackAction,
  trackWebVital,
  type TelemetryEvent,
} from './telemetry';

describe('telemetry', () => {
  const sink = vi.fn((event: TelemetryEvent) => event);

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
});
