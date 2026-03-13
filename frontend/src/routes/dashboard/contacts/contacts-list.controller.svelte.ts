import { goto } from '$app/navigation';
import type { ContactResponse } from '$lib/api/contacts';
import { announce } from '$lib/utils/a11y';
import { contactsQueryHandler } from '$lib/services/contacts/contacts-query-handler';
import { presentError } from '$lib/services/error/error-presenter';
import { contactsService } from '$lib/services/contacts/contacts.service';
import { clampPositiveInt } from '$lib/services/validation/validators';
import { authStore } from '$lib/stores/auth.store';
import { uiStore } from '$lib/stores/ui.store';
import { filterAndSortContacts, type ContactsSortKey } from '$lib/contacts/listing';
import { trackAction, trackError } from '$lib/utils/telemetry';

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return clampPositiveInt(parsed, fallback);
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

function toContactsErrorView(
  error: unknown,
  fallbackMessage: string
): ContactsErrorView {
  const presented = presentError(error, { fallbackMessage });
  return {
    message: presented.message,
    details: presented.details,
    correlationId: presented.correlationId,
  };
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
    trackAction('contacts_list_retry', { status: 'start' });
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

    try {
      const context = authStore.getRequestContext();
      trackAction('contact_delete', {
        status: 'start',
        details: { contactId: contact.id },
      });
      await contactsService.delete({
        context,
        id: contact.id,
      });
      uiStore.enqueueNotification('success', 'Contact deleted.');
      trackAction('contact_delete', {
        status: 'success',
        details: { contactId: contact.id },
      });
      announce('Contact deleted.');
      await this.loadContacts();
    } catch (error) {
      const presented = presentError(error, {
        fallbackMessage: 'Unable to delete contact.',
      });
      uiStore.enqueueNotification('error', presented.message, {
        correlationId: presented.correlationId,
      });
      trackAction('contact_delete', {
        status: 'failure',
        message: presented.message,
        correlationId: presented.correlationId,
        details: { contactId: contact.id },
      });
      trackError('contact_delete_failure', {
        message: presented.message,
        correlationId: presented.correlationId,
        details: presented.details,
      });
      announce(presented.message, 'assertive');
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
    trackAction('contacts_list_load', { status: 'start' });
    announce('Loading contacts.');
    this.error = {
      message: '',
      details: [],
      correlationId: '',
    };

    try {
      const context = authStore.getRequestContext();
      const response = await contactsQueryHandler.list({
        context,
        page: this.page,
        pageSize: this.pageSize,
      });

      this.contacts = response.items;
      this.totalCount = response.totalCount;
      this.page = response.page;
      this.pageSize = response.pageSize;
      this.state = response.items.length > 0 ? 'ready' : 'empty';
      trackAction('contacts_list_load', {
        status: 'success',
        details: {
          page: response.page,
          pageSize: response.pageSize,
          totalCount: response.totalCount,
        },
      });
      announce(
        response.items.length > 0
          ? `Loaded ${response.items.length} contacts on page ${response.page}.`
          : 'No contacts found for the current filters.',
        'polite'
      );
    } catch (error) {
      this.state = 'error';
      this.error = toContactsErrorView(error, 'Unable to load contacts.');
      trackAction('contacts_list_load', {
        status: 'failure',
        message: this.error.message,
        correlationId: this.error.correlationId,
        details: { page: this.page, pageSize: this.pageSize },
      });
      trackError('contacts_list_load_failure', {
        message: this.error.message,
        details: this.error.details,
        correlationId: this.error.correlationId,
      });
      announce(this.error.message, 'assertive');
    } finally {
      this.isBusy = false;
    }
  }
}
