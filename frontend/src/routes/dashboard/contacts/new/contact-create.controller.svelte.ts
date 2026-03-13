import { goto } from '$app/navigation';
import type { ContactCreateRequest } from '$lib/api/contacts';
import {
  createEmptyContactFormData,
  type ContactFormData,
} from '$lib/contacts/contact-form';
import { contactsService } from '$lib/services/contacts/contacts.service';
import { presentError } from '$lib/services/error/error-presenter';
import { authStore } from '$lib/stores/auth.store';
import { uiStore } from '$lib/stores/ui.store';
import { announce } from '$lib/utils/a11y';
import { trackAction, trackError } from '$lib/utils/telemetry';

interface CreateErrorView {
  message: string;
  details: string[];
  correlationId: string;
}

function toCreateErrorView(error: unknown): CreateErrorView {
  const presented = presentError(error, {
    fallbackMessage: 'Unable to create contact.',
  });
  return {
    message: presented.message,
    details: presented.details,
    correlationId: presented.correlationId,
  };
}

export class ContactCreateController {
  formData = $state<ContactFormData>(createEmptyContactFormData());
  isSubmitting = $state(false);
  error = $state<CreateErrorView>({
    message: '',
    details: [],
    correlationId: '',
  });

  async create(payload: ContactCreateRequest): Promise<void> {
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
      announce('Creating contact.');
      trackAction('contact_create', { status: 'start' });
      const created = await contactsService.create({
        context,
        payload,
      });

      uiStore.enqueueNotification('success', 'Contact created successfully.');
      trackAction('contact_create', {
        status: 'success',
        details: { contactId: created.id },
      });
      announce('Contact created successfully.');
      await goto(`/dashboard/contacts/${created.id}`);
    } catch (error) {
      this.error = toCreateErrorView(error);
      trackAction('contact_create', {
        status: 'failure',
        message: this.error.message,
        correlationId: this.error.correlationId,
      });
      trackError('contact_create_failure', {
        message: this.error.message,
        details: this.error.details,
        correlationId: this.error.correlationId,
      });
      announce(this.error.message, 'assertive');
    } finally {
      this.isSubmitting = false;
    }
  }

  async cancel(): Promise<void> {
    await goto('/dashboard/contacts');
  }
}
