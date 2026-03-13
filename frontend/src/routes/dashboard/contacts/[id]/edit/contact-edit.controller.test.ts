import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { RequestError } from '$lib/api/errors';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/api/contacts', () => ({
  getContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

import { getContact, updateContact } from '$lib/api/contacts';
import { ContactEditController } from './contact-edit.controller.svelte';

const getContactMock = vi.mocked(getContact);
const updateContactMock = vi.mocked(updateContact);

describe('ContactEditController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    authStore.setSession('access-token', TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');

    getContactMock.mockResolvedValue({
      id: 'contact-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: null,
      address: null,
      metadata: {},
      createdAt: '2026-03-10T12:00:00Z',
      updatedAt: '2026-03-12T12:00:00Z',
    });
  });

  it('surfaces correlation ids on save failures', async () => {
    updateContactMock.mockRejectedValue(
      new RequestError({
        kind: 'conflict',
        status: 409,
        code: 'version_conflict',
        message: 'Contact has changed.',
        details: ['Refresh and try again.'],
        correlationId: 'corr-edit',
      })
    );

    const controller = new ContactEditController();
    await controller.mount('contact-1');
    await controller.save('contact-1', {
      firstName: 'Ada',
    });

    expect(controller.error).toEqual({
      message: 'Contact has changed.',
      details: ['Refresh and try again.'],
      correlationId: 'corr-edit',
    });
  });
});
