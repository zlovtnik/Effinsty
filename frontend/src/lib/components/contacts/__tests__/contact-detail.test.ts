// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ContactDetail from '../ContactDetail.svelte';
import type { ContactResponse } from '$lib/api/contacts';

const contact: ContactResponse = {
  id: 'contact-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '5551111111',
  address: '123 Main St',
  metadata: {
    team: 'platform',
  },
  createdAt: '2026-03-10T12:00:00Z',
  updatedAt: '2026-03-12T12:00:00Z',
};

function renderContactDetail(overrides: Partial<import('svelte').ComponentProps<typeof ContactDetail>> = {}) {
  return render(ContactDetail, {
    props: {
      state: 'ready',
      contact,
      isDeleting: false,
      errorMessage: '',
      errorDetails: [],
      errorCorrelationId: '',
      onBack: vi.fn(),
      onRetry: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      ...overrides,
    },
  });
}

describe('ContactDetail', () => {
  it('renders loading state shell', () => {
    const { container } = renderContactDetail({
      state: 'loading',
      contact: null,
    });

    expect(screen.getByRole('heading', { name: 'Contact details' })).toBeInTheDocument();
    expect(container.querySelector('.state')).toBeTruthy();
  });

  it('renders error state and retry action', async () => {
    const onRetry = vi.fn();
    renderContactDetail({
      state: 'error',
      contact: null,
      errorMessage: 'Unable to load contact.',
      errorDetails: ['Deleted by another user.'],
      errorCorrelationId: 'corr-detail',
      onRetry,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load contact.');
    expect(screen.getByText('Deleted by another user.')).toBeInTheDocument();
    expect(screen.getByText('corr-detail')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders contact metadata and action callbacks', async () => {
    const onBack = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderContactDetail({
      onBack,
      onEdit,
      onDelete,
    });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('team: platform');

    await fireEvent.click(screen.getByRole('button', { name: 'Back to contacts' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith('contact-1');
    expect(onDelete).toHaveBeenCalledWith('contact-1');
  });

  it('shows delete-busy copy while deletion is active', () => {
    renderContactDetail({
      isDeleting: true,
    });

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
  });
});
