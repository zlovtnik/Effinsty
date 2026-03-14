// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/svelte';
import { contactsService } from '$lib/services/contacts/contacts.service';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { sessionStore } from '$lib/stores/session.store';
import { uiStore } from '$lib/stores/ui.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';
import ContactsPage from '../+page.svelte';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/services/contacts/contacts.service', () => ({
  contactsService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const listContactsMock = vi.mocked(contactsService.list);

describe('contacts list page a11y', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    tenantStore.reset();
    sessionStore.reset();
    uiStore.reset();

    authStore.setAuthenticated();
    tenantStore.resolveTenant('tenant-a');
    window.history.replaceState({}, '', '/dashboard/contacts?page=1&pageSize=20');

    listContactsMock.mockResolvedValue({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          phone: '555-111-1111',
          address: null,
          metadata: {},
          createdAt: '2026-03-10T12:00:00Z',
          updatedAt: '2026-03-12T12:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 30,
    });
  });

  it('exposes no critical or serious violations', async () => {
    render(ContactsPage);

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    const result = await axe(document.body);
    const critical = result.violations.filter((violation) =>
      violation.impact === 'critical' || violation.impact === 'serious'
    );

    expect(critical).toHaveLength(0);
  });
});
