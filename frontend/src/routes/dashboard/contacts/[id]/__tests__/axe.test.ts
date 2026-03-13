// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { readable } from 'svelte/store';
import { contactsService } from '$lib/services/contacts/contacts.service';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { sessionStore } from '$lib/stores/session.store';
import { TEST_SESSION_EXPIRY } from '$lib/test/auth-fixtures';
import DetailPage from '../+page.svelte';

vi.mock('$app/stores', () => ({
  page: readable({
    params: { id: '11111111-1111-1111-1111-111111111111' },
    url: new URL('http://localhost/dashboard/contacts/11111111-1111-1111-1111-111111111111'),
    route: { id: '/dashboard/contacts/[id]' },
    status: 200,
    error: null,
    state: null,
  }),
}));

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

describe('contact detail page a11y', () => {
  it('exposes no critical or serious violations', async () => {
    authStore.reset();
    tenantStore.reset();
    sessionStore.reset();
    authStore.setSession('access-token', TEST_SESSION_EXPIRY);
    tenantStore.resolveTenant('tenant-a');
    vi.mocked(contactsService.get).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '555-111-1111',
      address: '123 Main St',
      metadata: { team: 'platform' },
      createdAt: '2026-03-10T12:00:00Z',
      updatedAt: '2026-03-12T12:00:00Z',
    });

    render(DetailPage);

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
