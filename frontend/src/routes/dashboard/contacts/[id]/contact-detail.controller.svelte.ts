import { goto } from '$app/navigation';
import { deleteContact, getContact, type ContactResponse } from '$lib/api/contacts';
import { isRequestError } from '$lib/api/errors';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { uiStore } from '$lib/stores/ui.store';
import { announce } from '$lib/utils/a11y';
import { get } from 'svelte/store';

function createCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

interface ContactErrorView {
  message: string;
  details: string[];
  correlationId: string;
}

export type ContactDetailState = 'loading' | 'ready' | 'error';

export class ContactDetailController {
  state = $state<ContactDetailState>('loading');
  contact = $state<ContactResponse | null>(null);
  isDeleting = $state(false);

  error = $state<ContactErrorView>({
    message: '',
    details: [],
    correlationId: '',
  });

  async mount(contactId: string): Promise<void> {
    await this.loadContact(contactId);
  }

  async retry(contactId: string): Promise<void> {
    announce('Retrying to load contact details.');
    await this.loadContact(contactId);
  }

  async toList(): Promise<void> {
    await goto('/dashboard/contacts');
  }

  async toEdit(id: string): Promise<void> {
    await goto(`/dashboard/contacts/${id}/edit`);
  }

  async deleteById(contactId: string): Promise<void> {
    if (this.isDeleting) {
      return;
    }

    const confirmed = await uiStore.requestConfirmation({
      title: 'Delete contact',
      message: 'Delete this contact? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      uiStore.enqueueNotification('error', 'Session context is missing. Please sign in again.');
      announce('Session context is missing. Please sign in again.', 'assertive');
      return;
    }

    this.isDeleting = true;
    announce('Deleting contact.');

    try {
      await deleteContact(
        tenantState.tenantId,
        authState.accessToken,
        contactId,
        createCorrelationId()
      );
      uiStore.enqueueNotification('success', 'Contact deleted.');
      announce('Contact deleted.');
      await goto('/dashboard/contacts');
    } catch (error) {
      const message = isRequestError(error) ? error.appError.message : 'Unable to delete contact.';
      uiStore.enqueueNotification('error', message);
      announce(message, 'assertive');
    } finally {
      this.isDeleting = false;
    }
  }

  private async loadContact(contactId: string): Promise<void> {
    this.state = 'loading';
    announce('Loading contact details.');
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
      return;
    }

    try {
      this.contact = await getContact(
        tenantState.tenantId,
        authState.accessToken,
        contactId,
        createCorrelationId()
      );
      this.state = 'ready';
      announce('Contact loaded.');
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
          message: error instanceof Error ? error.message : 'Unable to load contact.',
          details: [],
          correlationId: '',
        };
      }

      announce(this.error.message, 'assertive');
    }
  }
}
