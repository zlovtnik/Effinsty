import { goto } from '$app/navigation';
import {
  deleteContact,
  getContact,
  updateContact,
  type ContactResponse,
  type ContactUpdateRequest,
} from '$lib/api/contacts';
import { isRequestError } from '$lib/api/errors';
import { contactToFormData, type ContactFormData } from '$lib/contacts/contact-form';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { uiStore } from '$lib/stores/ui.store';
import { announce } from '$lib/utils/a11y';
import { trackAction, trackError } from '$lib/utils/telemetry';
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

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      this.error = {
        message: 'Session context is missing. Please sign in again.',
        details: [],
        correlationId: '',
      };
      announce('Session context is missing. Please sign in again.', 'assertive');
      return;
    }

    this.isSubmitting = true;
    this.error = {
      message: '',
      details: [],
      correlationId: '',
    };

    try {
      announce('Updating contact.');
      trackAction('contact_update', {
        status: 'start',
        details: { contactId },
      });
      const updated = await updateContact(
        tenantState.tenantId,
        authState.accessToken,
        contactId,
        payload,
        createCorrelationId()
      );

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
      if (isRequestError(error)) {
        this.error = {
          message: error.appError.message,
          details: error.appError.details,
          correlationId: error.appError.correlationId ?? '',
        };
      } else {
        this.error = {
          message: error instanceof Error ? error.message : 'Unable to update contact.',
          details: [],
          correlationId: '',
        };
      }
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

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      uiStore.enqueueNotification('error', 'Session context is missing. Please sign in again.');
      announce('Session context is missing. Please sign in again.', 'assertive');
      return;
    }

    this.isDeleting = true;
    trackAction('contact_delete', {
      status: 'start',
      details: { contactId },
    });
    announce('Deleting contact.');

    try {
      await deleteContact(
        tenantState.tenantId,
        authState.accessToken,
        contactId,
        createCorrelationId()
      );
      uiStore.enqueueNotification('success', 'Contact deleted.');
      trackAction('contact_delete', {
        status: 'success',
        details: { contactId },
      });
      announce('Contact deleted.');
      await goto('/dashboard/contacts');
    } catch (error) {
      const message = isRequestError(error) ? error.appError.message : 'Unable to delete contact.';
      const correlationId = isRequestError(error) ? error.appError.correlationId ?? '' : '';
      uiStore.enqueueNotification('error', message, { correlationId });
      trackAction('contact_delete', {
        status: 'failure',
        message,
        correlationId,
        details: { contactId },
      });
      trackError('contact_delete_failure', {
        message,
        details: isRequestError(error) ? error.appError.details : [],
        correlationId,
      });
      announce(message, 'assertive');
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
      const found = await getContact(
        tenantState.tenantId,
        authState.accessToken,
        contactId,
        createCorrelationId()
      );

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
