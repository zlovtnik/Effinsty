// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { ContactResponse, PagedResponse } from '$lib/api/contacts';
import { RequestError } from '$lib/api/errors';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { sessionStore } from '$lib/stores/session.store';
import { uiStore } from '$lib/stores/ui.store';

vi.mock('$app/navigation', () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/api/contacts', () => ({
  listContacts: vi.fn(),
  deleteContact: vi.fn(),
}));

import { goto } from '$app/navigation';
import { listContacts } from '$lib/api/contacts';
import ContactsPage from '../+page.svelte';

const gotoMock = vi.mocked(goto);
const listContactsMock = vi.mocked(listContacts);

function mockPagedResponse(overrides: Partial<PagedResponse<ContactResponse>> = {}): PagedResponse<ContactResponse> {
  return {
    items: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '5551111111',
        address: null,
        metadata: {},
        createdAt: '2026-03-10T12:00:00Z',
        updatedAt: '2026-03-12T12:00:00Z',
      },
    ],
    page: 1,
    pageSize: 20,
    totalCount: 30,
    ...overrides,
  };
}

describe('contacts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.reset();
    sessionStore.reset();
    tenantStore.reset();
    uiStore.reset();

    authStore.setSession('access-token', '2026-03-13T10:00:00Z');
    tenantStore.resolveTenant('tenant-a');
    window.history.replaceState({}, '', '/dashboard/contacts?page=1&pageSize=20');
  });

  it('renders loading then loaded list with DG-3 copy', async () => {
    listContactsMock.mockImplementation(async () => {
      await Promise.resolve();
      return mockPagedResponse();
    });

    render(ContactsPage);

    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Search within page 1 of 2 contacts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search this page of contacts')).toBeInTheDocument();
    expect(screen.getByText('Results are limited to the currently loaded page.')).toBeInTheDocument();
  });

  it('renders empty state when page has no contacts', async () => {
    listContactsMock.mockResolvedValue(mockPagedResponse({ items: [], totalCount: 0 }));

    render(ContactsPage);

    expect(await screen.findByText('No contacts found')).toBeInTheDocument();
  });

  it('renders error details with correlation id and supports retry', async () => {
    listContactsMock
      .mockRejectedValueOnce(
        new RequestError({
          kind: 'network',
          code: 'network_error',
          message: 'Unable to load contacts.',
          details: ['gateway timeout'],
          correlationId: 'corr-list-1',
        })
      )
      .mockResolvedValueOnce(mockPagedResponse());

    render(ContactsPage);

    expect(await screen.findByText('Unable to load contacts.')).toBeInTheDocument();
    expect(screen.getByText('gateway timeout')).toBeInTheDocument();
    expect(screen.getByText('corr-list-1')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
  });

  it('moves to next page and updates query call contract', async () => {
    listContactsMock
      .mockResolvedValueOnce(mockPagedResponse())
      .mockResolvedValueOnce(mockPagedResponse({
        page: 2,
        items: [
          {
            ...mockPagedResponse().items[0],
            id: '22222222-2222-2222-2222-222222222222',
            firstName: 'Grace',
            lastName: 'Hopper',
          },
        ],
      }));

    render(ContactsPage);

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: /Go to next page/i }));

    await waitFor(() => {
      expect(gotoMock).toHaveBeenCalledWith('/dashboard/contacts?page=2&pageSize=20', {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    });
  });
});
