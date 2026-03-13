import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { uiStore } from '$lib/stores/ui.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/api/contacts', () => ({
  listContacts: vi.fn(),
  deleteContact: vi.fn(),
}));

import { listContacts, deleteContact } from '$lib/api/contacts';
import { ContactsListController } from './contacts-list.controller.svelte';

const listContactsMock = vi.mocked(listContacts);
const deleteContactMock = vi.mocked(deleteContact);

describe('ContactsListController delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    uiStore.reset();

    authStore.setSession('access-token', TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');

    listContactsMock.mockResolvedValue({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          phone: null,
          address: null,
          metadata: {},
          createdAt: '2026-03-10T12:00:00Z',
          updatedAt: '2026-03-10T12:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    });
  });

  it('does not delete when confirmation is canceled', async () => {
    const controller = new ContactsListController();
    await controller.mount();

    const promise = controller.deleteFromList(controller.contacts[0]!);
    uiStore.resolveConfirmation(false);
    await promise;

    expect(deleteContactMock).not.toHaveBeenCalled();
  });

  it('deletes and reloads when confirmation is accepted', async () => {
    deleteContactMock.mockResolvedValue({ success: true });

    const controller = new ContactsListController();
    await controller.mount();

    const promise = controller.deleteFromList(controller.contacts[0]!);
    uiStore.resolveConfirmation(true);
    await promise;

    expect(deleteContactMock).toHaveBeenCalledTimes(1);
    expect(listContactsMock).toHaveBeenCalledTimes(2);
  });

  it('ignores page changes above available pages', async () => {
    const controller = new ContactsListController();
    await controller.mount();

    await controller.changePage(2);

    expect(controller.page).toBe(1);
    expect(listContactsMock).toHaveBeenCalledTimes(1);
  });
});
