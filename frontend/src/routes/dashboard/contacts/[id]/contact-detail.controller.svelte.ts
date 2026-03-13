import { goto } from '$app/navigation';
import type { ContactResponse } from '$lib/api/contacts';
import { contactsQueryHandler } from '$lib/services/contacts/contacts-query-handler';
import { contactsService } from '$lib/services/contacts/contacts.service';
import { presentError } from '$lib/services/error/error-presenter';
import { authStore } from '$lib/stores/auth.store';
import { uiStore } from '$lib/stores/ui.store';
import { announce } from '$lib/utils/a11y';
import { trackAction, trackError } from '$lib/utils/telemetry';

interface ContactErrorView {
  message: string;
  details: string[];
  correlationId: string;
}

function toContactErrorView(
  error: unknown,
  fallbackMessage: string
): ContactErrorView {
  const presented = presentError(error, { fallbackMessage });
  return {
    message: presented.message,
    details: presented.details,
    correlationId: presented.correlationId,
  };
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
    trackAction('contact_detail_retry', {
      status: 'start',
      details: { contactId },
    });
    announce('Retrying to load contact details.');

    try {
      await this.loadContact(contactId);
    } catch (error) {
      trackAction('contact_detail_retry', {
        status: 'failure',
        message: error instanceof Error ? error.message : 'Unable to load contact.',
        details: { contactId },
      });
      throw error;
    }

    trackAction('contact_detail_retry', {
      status: this.state === 'ready' ? 'success' : 'failure',
      message: this.state === 'ready' ? undefined : this.error.message,
      correlationId: this.state === 'ready' ? undefined : this.error.correlationId,
      details: { contactId },
    });
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

    this.isDeleting = true;
    trackAction('contact_delete', {
      status: 'start',
      details: { contactId },
    });
    announce('Deleting contact.');

    try {
      const context = authStore.getRequestContext();
      await contactsService.delete({
        context,
        id: contactId,
      });
      uiStore.enqueueNotification('success', 'Contact deleted.');
      trackAction('contact_delete', {
        status: 'success',
        details: { contactId },
      });
      announce('Contact deleted.');
      await goto('/dashboard/contacts');
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
        details: { contactId },
      });
      trackError('contact_delete_failure', {
        message: presented.message,
        details: presented.details,
        correlationId: presented.correlationId,
      });
      announce(presented.message, 'assertive');
    } finally {
      this.isDeleting = false;
    }
  }

  private async loadContact(contactId: string): Promise<void> {
    this.state = 'loading';
    trackAction('contact_detail_load', {
      status: 'start',
      details: { contactId },
    });
    announce('Loading contact details.');
    this.error = {
      message: '',
      details: [],
      correlationId: '',
    };

    try {
      const context = authStore.getRequestContext();
      this.contact = await contactsQueryHandler.get({
        context,
        id: contactId,
      });
      this.state = 'ready';
      trackAction('contact_detail_load', {
        status: 'success',
        details: { contactId },
      });
      announce('Contact loaded.');
    } catch (error) {
      this.state = 'error';
      this.error = toContactErrorView(error, 'Unable to load contact.');

      trackAction('contact_detail_load', {
        status: 'failure',
        message: this.error.message,
        correlationId: this.error.correlationId,
        details: { contactId },
      });
      trackError('contact_detail_load_failure', {
        message: this.error.message,
        details: this.error.details,
        correlationId: this.error.correlationId,
      });
      announce(this.error.message, 'assertive');
    }
  }
}
