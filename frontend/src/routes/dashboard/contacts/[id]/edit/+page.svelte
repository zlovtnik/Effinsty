<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import type { ContactUpdateRequest } from '$lib/api/contacts';
  import ContactForm from '$lib/components/contacts/ContactForm.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import { ContactEditController } from './contact-edit.controller.svelte';

  const controller = new ContactEditController();
  const contactId = get(page).params.id;

  onMount(() => {
    void controller.mount(contactId);
  });

  async function onSubmit(payload: ContactUpdateRequest): Promise<void> {
    await controller.save(contactId, payload);
  }
</script>

<section class="contact-edit container-page">
  <header class="header">
    <h2>Edit Contact</h2>
    <Button type="button" variant="secondary" onclick={() => void controller.cancel(contactId)}>Back</Button>
  </header>

  {#if controller.state === 'loading'}
    <div class="surface-card state">
      <Skeleton lines={8} />
    </div>
  {:else if controller.state === 'error'}
    <div class="state-stack">
      <Alert
        title="Unable to load contact"
        message={controller.error.message}
        details={controller.error.details}
        correlationId={controller.error.correlationId}
        tone="danger"
        role="alert"
      />
      <Button type="button" variant="secondary" onclick={() => void controller.retry(contactId)}>Retry</Button>
    </div>
  {:else if controller.formData}
    {#if controller.error.message}
      <Alert
        title="Unable to save contact"
        message={controller.error.message}
        details={controller.error.details}
        correlationId={controller.error.correlationId}
        tone="danger"
        role="alert"
      />
    {/if}

    <ContactForm
      mode="edit"
      initialData={controller.formData}
      isSubmitting={controller.isSubmitting}
      submitLabel="Save changes"
      onSubmit={(payload) => onSubmit(payload as ContactUpdateRequest)}
      onCancel={() => void controller.cancel(contactId)}
    />

    <div class="delete-zone surface-card">
      <h3>Danger zone</h3>
      <p>Deleting removes this contact permanently.</p>
      <Button type="button" variant="danger" onclick={() => void controller.deleteById(contactId)}>
        {controller.isDeleting ? 'Deleting...' : 'Delete contact'}
      </Button>
    </div>
  {/if}
</section>

<style>
  .contact-edit {
    display: grid;
    gap: 0.8rem;
    padding-block: 0.7rem 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .state,
  .delete-zone,
  .state-stack {
    padding: 0.9rem;
  }

  .state-stack {
    display: grid;
    gap: 0.5rem;
  }

  .delete-zone {
    display: grid;
    gap: 0.35rem;
    border-color: hsl(var(--danger) / 0.35);
    background: hsl(var(--danger) / 0.08);
  }

  .delete-zone h3,
  .delete-zone p {
    margin: 0;
  }

  .delete-zone :global(button),
  .header :global(button) {
    font: inherit;
    border-radius: var(--radius-sm);
  }
</style>
