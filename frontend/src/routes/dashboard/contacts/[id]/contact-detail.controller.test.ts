import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { RequestError } from '$lib/api/errors';
import { contactsQueryHandler } from '$lib/services/contacts/contacts-query-handler';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/utils/telemetry', () => ({
  trackAction: vi.fn(),
  trackError: vi.fn(),
}));

import { trackAction } from '$lib/utils/telemetry';
import { ContactDetailController } from './contact-detail.controller.svelte';

const getContactMock = vi.spyOn(contactsQueryHandler, 'get');
const trackActionMock = vi.mocked(trackAction);

describe('ContactDetailController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    authStore.setAuthenticated();
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

  it('closes retry telemetry after a failed reload attempt', async () => {
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
    await controller.retry('contact-1');

    expect(trackActionMock).toHaveBeenCalledWith('contact_detail_retry', {
      status: 'start',
      details: { contactId: 'contact-1' },
    });
    expect(trackActionMock).toHaveBeenCalledWith('contact_detail_retry', {
      status: 'failure',
      message: 'Contact was not found.',
      correlationId: 'corr-detail',
      details: { contactId: 'contact-1' },
    });
  });
});
