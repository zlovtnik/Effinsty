import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { RequestError } from '$lib/api/errors';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/api/contacts', () => ({
  getContact: vi.fn(),
  deleteContact: vi.fn(),
}));

import { getContact } from '$lib/api/contacts';
import { ContactDetailController } from './contact-detail.controller.svelte';

const getContactMock = vi.mocked(getContact);

describe('ContactDetailController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    authStore.setSession('access-token', '2026-03-13T10:00:00Z');
    tenantStore.resolveTenant('tenant-a');
  });

  it('stores error details and correlation ids when loading fails', async () => {
    getContactMock.mockRejectedValue(
      new RequestError({
        kind: 'notFound',
        status: 404,
        code: 'not_found',
        message: 'Contact was not found.',
        details: ['Deleted by another user.'],
        correlationId: 'corr-detail',
      })
    );

    const controller = new ContactDetailController();
    await controller.mount('contact-1');

    expect(controller.state).toBe('error');
    expect(controller.error).toEqual({
      message: 'Contact was not found.',
      details: ['Deleted by another user.'],
      correlationId: 'corr-detail',
    });
  });
});
