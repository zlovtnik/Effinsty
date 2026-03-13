// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ContactList from '../ContactList.svelte';
import type { ContactResponse } from '$lib/api/contacts';

const contact: ContactResponse = {
  id: 'contact-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '5551111111',
  address: null,
  metadata: {},
  createdAt: '2026-03-10T12:00:00Z',
  updatedAt: '2026-03-12T12:00:00Z',
};

function renderContactList(overrides: Partial<import('svelte').ComponentProps<typeof ContactList>> = {}) {
  return render(ContactList, {
    props: {
      state: 'ready',
      isBusy: false,
      filteredContacts: [contact],
      errorMessage: '',
      errorDetails: [],
      errorCorrelationId: '',
      page: 1,
      pageSize: 20,
      totalCount: 30,
      search: '',
      searchLabel: 'Search within page 1 of 2 contacts',
      sortKey: 'updated_desc',
      onSearch: vi.fn(),
      onSort: vi.fn(),
      onRetry: vi.fn(),
      onCreate: vi.fn(),
      onPageChange: vi.fn(),
      onPageSizeChange: vi.fn(),
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      ...overrides,
    },
  });
}

describe('ContactList', () => {
  it('renders ready state and wires list actions and paging controls', async () => {
    const onSearch = vi.fn();
    const onSort = vi.fn();
    const onPageChange = vi.fn();
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderContactList({
      onSearch,
      onSort,
      onPageChange,
      onView,
      onEdit,
      onDelete,
    });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText('Search within page 1 of 2 contacts'), {
      target: { value: 'Ada' },
    });
    await fireEvent.change(screen.getByLabelText('Sort'), {
      target: { value: 'name_asc' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.click(screen.getByRole('button', { name: /Go to next page/i }));

    expect(onSearch).toHaveBeenCalledWith('Ada');
    expect(onSort).toHaveBeenCalledWith('name_asc');
    expect(onView).toHaveBeenCalledWith('contact-1');
    expect(onEdit).toHaveBeenCalledWith('contact-1');
    expect(onDelete).toHaveBeenCalledWith(contact);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders empty state and create action', async () => {
    const onCreate = vi.fn();
    renderContactList({
      state: 'empty',
      filteredContacts: [],
      totalCount: 0,
      onCreate,
    });

    expect(screen.getByRole('heading', { name: 'No contacts found' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Create your first contact' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders error state with correlation ids and retry action', async () => {
    const onRetry = vi.fn();
    renderContactList({
      state: 'error',
      filteredContacts: [],
      errorMessage: 'Unable to load contacts.',
      errorDetails: ['gateway timeout'],
      errorCorrelationId: 'corr-list',
      onRetry,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load contacts.');
    expect(screen.getByText('gateway timeout')).toBeInTheDocument();
    expect(screen.getByText('corr-list')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders page-scoped no-match state without falling back to empty state', () => {
    renderContactList({
      state: 'ready',
      filteredContacts: [],
    });

    expect(screen.getByText('No contacts match your search on this page.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No contacts found' })).not.toBeInTheDocument();
  });
});
