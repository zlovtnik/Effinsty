import { goto } from '$app/navigation';
import { deleteContact, listContacts, type ContactResponse } from '$lib/api/contacts';
import { isRequestError } from '$lib/api/errors';
import { announce } from '$lib/utils/a11y';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { uiStore } from '$lib/stores/ui.store';
import { filterAndSortContacts, type ContactsSortKey } from '$lib/contacts/listing';
import { get } from 'svelte/store';

function createCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function readPagingFromUrl(): { page: number; pageSize: number } {
  if (typeof globalThis.location === 'undefined') {
    return { page: 1, pageSize: 20 };
  }

  const params = new URLSearchParams(globalThis.location.search);
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(params.get('pageSize'), 20)));

  return { page, pageSize };
}

interface ContactsErrorView {
  message: string;
  details: string[];
  correlationId: string;
}

export type ContactsListState = 'loading' | 'ready' | 'empty' | 'error';

export class ContactsListController {
  state = $state<ContactsListState>('loading');
  isBusy = $state(false);

  contacts = $state<ContactResponse[]>([]);
  totalCount = $state(0);
  page = $state(1);
  pageSize = $state(20);

  search = $state('');
  sortKey = $state<ContactsSortKey>('updated_desc');

  error = $state<ContactsErrorView>({
    message: '',
    details: [],
    correlationId: '',
  });

  totalPages = $derived(Math.max(1, Math.ceil(this.totalCount / this.pageSize)));
  filteredContacts = $derived(filterAndSortContacts(this.contacts, this.search, this.sortKey));
  searchLabel = $derived(`Search within page ${this.page} of ${this.totalPages} contacts`);

  async mount(): Promise<void> {
    const paging = readPagingFromUrl();
    this.page = paging.page;
    this.pageSize = paging.pageSize;
    await this.loadContacts();
  }

  updateSearch(value: string): void {
    this.search = value;
  }

  updateSort(value: ContactsSortKey): void {
    this.sortKey = value;
  }

  async changePage(nextPage: number): Promise<void> {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page || this.isBusy) {
      return;
    }

    this.page = nextPage;
    await this.syncQueryAndReload();
  }

  async changePageSize(nextPageSize: number): Promise<void> {
    const safePageSize = Math.min(100, Math.max(1, Math.trunc(nextPageSize)));
    if (safePageSize === this.pageSize || this.isBusy) {
      return;
    }

    this.pageSize = safePageSize;
    this.page = 1;
    await this.syncQueryAndReload();
  }

  async retry(): Promise<void> {
    announce('Retrying to load contacts.');
    await this.loadContacts();
  }

  async navigateToNew(): Promise<void> {
    await goto('/dashboard/contacts/new');
  }

  async navigateToDetails(id: string): Promise<void> {
    await goto(`/dashboard/contacts/${id}`);
  }

  async navigateToEdit(id: string): Promise<void> {
    await goto(`/dashboard/contacts/${id}/edit`);
  }

  async deleteFromList(contact: ContactResponse): Promise<void> {
    const confirmed = await uiStore.requestConfirmation({
      title: 'Delete contact',
      message: `Delete ${contact.firstName} ${contact.lastName}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    announce('Delete contact request submitted.');

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      uiStore.enqueueNotification('error', 'Session context is missing. Please sign in again.');
      announce('Session context is missing. Please sign in again.', 'assertive');
      return;
    }

    try {
      await deleteContact(
        tenantState.tenantId,
        authState.accessToken,
        contact.id,
        createCorrelationId()
      );
      uiStore.enqueueNotification('success', 'Contact deleted.');
      announce('Contact deleted.');
      await this.loadContacts();
    } catch (error) {
      const message = isRequestError(error) ? error.appError.message : 'Unable to delete contact.';
      uiStore.enqueueNotification('error', message);
      announce(message, 'assertive');
    }
  }

  private async syncQueryAndReload(): Promise<void> {
    announce('Loading contacts.');
    await goto(`/dashboard/contacts?page=${this.page}&pageSize=${this.pageSize}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });

    await this.loadContacts();
  }

  private async loadContacts(): Promise<void> {
    this.isBusy = true;
    this.state = 'loading';
    announce('Loading contacts.');
    this.error = {
      message: '',
      details: [],
      correlationId: '',
    };

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      this.state = 'error';
      this.error = {
        message: 'Session context is missing. Please sign in again.',
        details: [],
        correlationId: '',
      };
      announce('Session context is missing. Please sign in again.', 'assertive');
      this.isBusy = false;
      return;
    }

    try {
      const response = await listContacts(
        tenantState.tenantId,
        authState.accessToken,
        this.page,
        this.pageSize,
        createCorrelationId()
      );

      this.contacts = response.items;
      this.totalCount = response.totalCount;
      this.page = response.page;
      this.pageSize = response.pageSize;
      this.state = response.items.length > 0 ? 'ready' : 'empty';
      announce(
        response.items.length > 0
          ? `Loaded ${response.items.length} contacts on page ${response.page}.`
          : 'No contacts found for the current filters.',
        'polite'
      );
    } catch (error) {
      this.state = 'error';

      if (isRequestError(error)) {
        this.error = {
          message: error.appError.message,
          details: error.appError.details,
          correlationId: error.appError.correlationId ?? '',
        };
      } else {
        this.error = {
          message: error instanceof Error ? error.message : 'Unable to load contacts.',
          details: [],
          correlationId: '',
        };
      }
      announce(this.error.message, 'assertive');
    } finally {
      this.isBusy = false;
    }
  }
}
