<script lang="ts">
  import type { ContactCreateRequest } from '$lib/api/contacts';
  import ContactForm from '$lib/components/contacts/ContactForm.svelte';
  import ErrorDetailsPanel from '$lib/components/contacts/ErrorDetailsPanel.svelte';
  import { ContactCreateController } from './contact-create.controller.svelte';

  const controller = new ContactCreateController();
</script>

<section class="contact-new container-page">
  <header class="header">
    <h2>New Contact</h2>
    <p>Create a contact with backend-compatible validation.</p>
  </header>

  {#if controller.error.message}
    <ErrorDetailsPanel
      title="Unable to create contact"
      message={controller.error.message}
      details={controller.error.details}
      correlationId={controller.error.correlationId}
    />
  {/if}

  <ContactForm
    mode="create"
    initialData={controller.formData}
    isSubmitting={controller.isSubmitting}
    submitLabel="Create contact"
    onSubmit={(payload) => controller.create(payload as ContactCreateRequest)}
    onCancel={() => void controller.cancel()}
  />
</section>

<style>
  .contact-new {
    display: grid;
    gap: 0.8rem;
    padding-block: 0.7rem 1rem;
  }

  .header {
    display: grid;
    gap: 0.3rem;
  }

  .header h2,
  .header p {
    margin: 0;
  }

  .header p {
    color: hsl(var(--text) / 0.8);
  }
</style>
