import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { RequestError } from '$lib/api/errors';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/api/contacts', () => ({
  createContact: vi.fn(),
}));

import { createContact } from '$lib/api/contacts';
import { ContactCreateController } from './contact-create.controller.svelte';

const createContactMock = vi.mocked(createContact);

describe('ContactCreateController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    authStore.setSession('access-token', TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');
  });

  it('captures correlation ids on create failures', async () => {
    createContactMock.mockRejectedValue(
      new RequestError({
        kind: 'validation',
        status: 400,
        code: 'invalid_contact',
        message: 'Contact is invalid.',
        details: ['Email is required.'],
        correlationId: 'corr-create',
      })
    );

    const controller = new ContactCreateController();

    await controller.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(controller.error).toEqual({
      message: 'Contact is invalid.',
      details: ['Email is required.'],
      correlationId: 'corr-create',
    });
  });
});
