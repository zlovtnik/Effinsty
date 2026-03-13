<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import ContactDetail from '$lib/components/contacts/ContactDetail.svelte';
  import { ContactDetailController } from './contact-detail.controller.svelte';

  const controller = new ContactDetailController();
  const contactId = get(page).params.id;

  onMount(() => {
    void controller.mount(contactId);
  });
</script>

<ContactDetail
  state={controller.state}
  contact={controller.contact}
  isDeleting={controller.isDeleting}
  errorMessage={controller.error.message}
  errorDetails={controller.error.details}
  errorCorrelationId={controller.error.correlationId}
  onBack={() => controller.toList()}
  onRetry={() => controller.retry(contactId)}
  onEdit={(id) => controller.toEdit(id)}
  onDelete={(id) => controller.deleteById(id)}
/>
