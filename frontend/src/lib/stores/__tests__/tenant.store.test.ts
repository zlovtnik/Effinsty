import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { tenantStore } from '$lib/stores/tenant.store';

describe('tenantStore', () => {
  beforeEach(() => {
    tenantStore.reset();
  });

  it('starts with no selected tenant', () => {
    expect(get(tenantStore)).toEqual({
      tenantId: null,
      status: 'unknown',
      invalidReason: null,
      loading: false,
      error: null,
    });
  });

  it('stores an explicit tenant id', () => {
    tenantStore.setTenant('tenant-a');

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      status: 'unknown',
      invalidReason: null,
      loading: false,
      error: null,
    });
  });

  it('marks tenant as resolved after successful bootstrap', () => {
    tenantStore.setTenant('tenant-a');
    tenantStore.resolveTenant();

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      status: 'resolved',
      invalidReason: null,
      loading: false,
      error: null,
    });
  });

  it('marks tenant as invalid when backend rejects tenant context', () => {
    tenantStore.invalidateTenant('Unknown tenant id.', 'tenant-a');

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      status: 'invalid',
      invalidReason: 'Unknown tenant id.',
      loading: false,
      error: 'Unknown tenant id.',
    });
  });

  it('applies shared presented errors without forcing invalid status for generic failures', () => {
    tenantStore.setTenant('tenant-a');
    tenantStore.applyPresentedError({
      kind: 'network',
      message: 'Network request failed.',
      details: [],
      correlationId: 'corr-network',
    });

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      status: 'unknown',
      invalidReason: null,
      loading: false,
      error: 'Network request failed.',
    });
  });

  it('preserves invalid reason when applying non-forbidden errors to invalid state', () => {
    tenantStore.invalidateTenant('Unknown tenant id.', 'tenant-a');
    tenantStore.applyPresentedError({
      kind: 'network',
      message: 'Network request failed.',
      details: [],
      correlationId: 'corr-network',
    });

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      status: 'invalid',
      invalidReason: 'Unknown tenant id.',
      loading: false,
      error: 'Network request failed.',
    });
  });
});
