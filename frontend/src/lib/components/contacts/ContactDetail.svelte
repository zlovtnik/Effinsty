<script lang="ts">
  import type { ContactResponse } from '$lib/api/contacts';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';

  type ContactDetailState = 'loading' | 'ready' | 'error';

  interface Props {
    state: ContactDetailState;
    contact: ContactResponse | null;
    isDeleting?: boolean;
    errorMessage?: string;
    errorDetails?: string[];
    errorCorrelationId?: string;
    onBack: () => Promise<void> | void;
    onRetry: () => Promise<void> | void;
    onEdit: (id: string) => Promise<void> | void;
    onDelete: (id: string) => Promise<void> | void;
  }

  let {
    state,
    contact,
    isDeleting = false,
    errorMessage = '',
    errorDetails = [],
    errorCorrelationId = '',
    onBack,
    onRetry,
    onEdit,
    onDelete,
  }: Props = $props();
</script>

<section class="contact-detail container-page">
  <header class="header">
    <h2>Contact details</h2>
    <Button type="button" variant="secondary" onclick={() => void onBack()}>Back to contacts</Button>
  </header>

  {#if state === 'loading'}
    <div class="surface-card state">
      <Skeleton lines={6} />
    </div>
  {:else if state === 'error'}
    <div class="state-stack">
      <Alert
        title="Unable to load contact"
        message={errorMessage}
        details={errorDetails}
        correlationId={errorCorrelationId}
        tone="danger"
        role="alert"
      />
      <Button type="button" variant="secondary" onclick={() => void onRetry()}>Retry</Button>
    </div>
  {:else if contact}
    <article class="surface-card panel">
      <div class="panel-header">
        <h3>{contact.firstName} {contact.lastName}</h3>
        <div class="actions">
          <Button type="button" variant="secondary" onclick={() => void onEdit(contact.id)}>
            Edit
          </Button>
          <Button type="button" variant="danger" onclick={() => void onDelete(contact.id)}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      <dl class="detail-grid">
        <div>
          <dt>Email</dt>
          <dd>{contact.email ?? '—'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{contact.phone ?? '—'}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{contact.address ?? '—'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{new Date(contact.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <section class="metadata">
        <h4>Metadata</h4>
        {#if Object.keys(contact.metadata).length === 0}
          <p>No metadata values.</p>
        {:else}
          <ul>
            {#each Object.entries(contact.metadata) as [key, value]}
              <li><strong>{key}</strong>: {value}</li>
            {/each}
          </ul>
        {/if}
      </section>
    </article>
  {/if}
</section>

<style>
  .contact-detail {
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
  .panel,
  .state-stack {
    padding: 0.9rem;
  }

  .state-stack {
    display: grid;
    gap: 0.5rem;
  }

  .panel {
    display: grid;
    gap: 0.9rem;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.65rem;
    margin: 0;
  }

  dt {
    font-size: 0.8rem;
    text-transform: uppercase;
    color: hsl(var(--text) / 0.75);
    letter-spacing: 0.04em;
  }

  dd {
    margin: 0.25rem 0 0;
  }

  .metadata h4 {
    margin: 0 0 0.4rem;
  }

  .metadata ul {
    margin: 0;
    padding-left: 1rem;
    display: grid;
    gap: 0.25rem;
  }

  .actions :global(button),
  header :global(button) {
    font: inherit;
  }
</style>
