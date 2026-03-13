import { goto } from '$app/navigation';
import {
  type ContactResponse,
  type ContactUpdateRequest,
} from '$lib/api/contacts';
import { contactToFormData, type ContactFormData } from '$lib/contacts/contact-form';
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

export type ContactEditState = 'loading' | 'ready' | 'error';

export class ContactEditController {
  state = $state<ContactEditState>('loading');
  contact = $state<ContactResponse | null>(null);
  formData = $state<ContactFormData | null>(null);
  isSubmitting = $state(false);
  isDeleting = $state(false);

  error = $state<ContactErrorView>({
    message: '',
    details: [],
    correlationId: '',
  });

  async mount(contactId: string): Promise<void> {
    announce('Loading contact form.');
    await this.load(contactId);
  }

  async retry(contactId: string): Promise<void> {
    trackAction('contact_edit_retry', {
      status: 'start',
      details: { contactId },
    });
    announce('Retrying contact load.');
    await this.load(contactId);
  }

  async save(contactId: string, payload: ContactUpdateRequest): Promise<void> {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.error = {
      message: '',
      details: [],
      correlationId: '',
    };

    try {
      const context = authStore.getRequestContext();
      announce('Updating contact.');
      trackAction('contact_update', {
        status: 'start',
        details: { contactId },
      });
      const updated = await contactsService.update({
        context,
        id: contactId,
        payload,
      });

      this.contact = updated;
      this.formData = contactToFormData(updated);
      uiStore.enqueueNotification('success', 'Contact updated successfully.');
      trackAction('contact_update', {
        status: 'success',
        details: { contactId: updated.id },
      });
      announce('Contact updated successfully.');
      await goto(`/dashboard/contacts/${updated.id}`);
    } catch (error) {
      this.error = toContactErrorView(error, 'Unable to update contact.');
      trackAction('contact_update', {
        status: 'failure',
        message: this.error.message,
        correlationId: this.error.correlationId,
        details: { contactId },
      });
      trackError('contact_update_failure', {
        message: this.error.message,
        details: this.error.details,
        correlationId: this.error.correlationId,
      });
      announce(this.error.message, 'assertive');
    } finally {
      this.isSubmitting = false;
    }
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

  async cancel(contactId: string): Promise<void> {
    await goto(`/dashboard/contacts/${contactId}`);
  }

  private async load(contactId: string): Promise<void> {
    this.state = 'loading';
    trackAction('contact_edit_load', {
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
      const found = await contactsQueryHandler.get({
        context,
        id: contactId,
      });

      this.contact = found;
      this.formData = contactToFormData(found);
      this.state = 'ready';
      trackAction('contact_edit_load', {
        status: 'success',
        details: { contactId },
      });
      announce('Contact loaded.');
    } catch (error) {
      this.state = 'error';
      this.error = toContactErrorView(error, 'Unable to load contact.');

      trackAction('contact_edit_load', {
        status: 'failure',
        message: this.error.message,
        correlationId: this.error.correlationId,
        details: { contactId },
      });
      trackError('contact_edit_load_failure', {
        message: this.error.message,
        details: this.error.details,
        correlationId: this.error.correlationId,
      });
      announce(this.error.message, 'assertive');
    }
  }
}
