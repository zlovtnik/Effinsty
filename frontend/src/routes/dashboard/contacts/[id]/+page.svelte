<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import ErrorDetailsPanel from '$lib/components/contacts/ErrorDetailsPanel.svelte';
  import { ContactDetailController } from './contact-detail.controller.svelte';

  const controller = new ContactDetailController();
  const contactId = get(page).params.id;

  onMount(() => {
    void controller.mount(contactId);
  });
</script>

<section class="contact-detail container-page">
  <header class="header">
    <h2>Contact details</h2>
    <button type="button" class="secondary" onclick={() => void controller.toList()}>Back to contacts</button>
  </header>

  {#if controller.state === 'loading'}
    <div class="surface-card state">Loading contact...</div>
  {:else if controller.state === 'error'}
    <div class="state-stack">
      <ErrorDetailsPanel
        title="Unable to load contact"
        message={controller.error.message}
        details={controller.error.details}
        correlationId={controller.error.correlationId}
      />
      <button class="secondary" type="button" onclick={() => void controller.retry(contactId)}>Retry</button>
    </div>
  {:else if controller.contact}
    <article class="surface-card panel">
      <div class="panel-header">
        <h3>{controller.contact.firstName} {controller.contact.lastName}</h3>
        <div class="actions">
          <button type="button" class="secondary" onclick={() => void controller.toEdit(controller.contact!.id)}>
            Edit
          </button>
          <button type="button" class="danger" onclick={() => void controller.deleteById(controller.contact!.id)}>
            {controller.isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <dl class="detail-grid">
        <div>
          <dt>Email</dt>
          <dd>{controller.contact.email ?? '—'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{controller.contact.phone ?? '—'}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{controller.contact.address ?? '—'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{new Date(controller.contact.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <section class="metadata">
        <h4>Metadata</h4>
        {#if Object.keys(controller.contact.metadata).length === 0}
          <p>No metadata values.</p>
        {:else}
          <ul>
            {#each Object.entries(controller.contact.metadata) as [key, value]}
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

  button {
    font: inherit;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    padding: 0.4rem 0.62rem;
    cursor: pointer;
  }

  .secondary {
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
    border-color: hsl(var(--border));
  }

  .danger {
    background: hsl(var(--danger));
    color: white;
  }
</style>
