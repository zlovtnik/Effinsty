import { goto } from '$app/navigation';
import { createContact, type ContactCreateRequest } from '$lib/api/contacts';
import { isRequestError } from '$lib/api/errors';
import {
  createEmptyContactFormData,
  type ContactFormData,
} from '$lib/contacts/contact-form';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { uiStore } from '$lib/stores/ui.store';
import { get } from 'svelte/store';

function createCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

interface CreateErrorView {
  message: string;
  details: string[];
  correlationId: string;
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

    const authState = get(authStore);
    const tenantState = get(tenantStore);

    if (!authState.accessToken || !tenantState.tenantId) {
      this.error = {
        message: 'Session context is missing. Please sign in again.',
        details: [],
        correlationId: '',
      };
      this.isSubmitting = false;
      return;
    }

    try {
      const created = await createContact(
        tenantState.tenantId,
        authState.accessToken,
        payload,
        createCorrelationId()
      );

      uiStore.enqueueNotification('success', 'Contact created successfully.');
      await goto(`/dashboard/contacts/${created.id}`);
    } catch (error) {
      if (isRequestError(error)) {
        this.error = {
          message: error.appError.message,
          details: error.appError.details,
          correlationId: error.appError.correlationId ?? '',
        };
      } else {
        this.error = {
          message: error instanceof Error ? error.message : 'Unable to create contact.',
          details: [],
          correlationId: '',
        };
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  async cancel(): Promise<void> {
    await goto('/dashboard/contacts');
  }
}
