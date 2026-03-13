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
      loading: false,
      error: null,
    });
  });

  it('stores an explicit tenant id', () => {
    tenantStore.setTenant('tenant-a');

    expect(get(tenantStore)).toEqual({
      tenantId: 'tenant-a',
      loading: false,
      error: null,
    });
  });
});
