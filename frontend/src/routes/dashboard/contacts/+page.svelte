<script lang="ts">
  import { onMount } from 'svelte';
  import ErrorDetailsPanel from '$lib/components/contacts/ErrorDetailsPanel.svelte';
  import Pagination from '$lib/components/contacts/Pagination.svelte';
  import { ContactsListController } from './contacts-list.controller.svelte';

  const controller = new ContactsListController();

  onMount(() => {
    void controller.mount();
  });
</script>

<section class="contacts-page container-page">
  <header class="page-header">
    <div>
      <h2>Contacts</h2>
      <p>Browse contacts with backend paging and page-scoped filtering.</p>
    </div>
    <button type="button" class="primary" onclick={() => void controller.navigateToNew()}>New contact</button>
  </header>

  <section class="toolbar surface-card">
    <label class="field">
      {controller.searchLabel}
      <input
        type="search"
        placeholder="Search this page of contacts"
        value={controller.search}
        oninput={(event) => controller.updateSearch((event.currentTarget as HTMLInputElement).value)}
      />
    </label>

    <label class="field small">
      Sort
      <select
        value={controller.sortKey}
        onchange={(event) => controller.updateSort((event.currentTarget as HTMLSelectElement).value as 'updated_desc' | 'name_asc' | 'name_desc')}
      >
        <option value="updated_desc">Recently updated</option>
        <option value="name_asc">Name A-Z</option>
        <option value="name_desc">Name Z-A</option>
      </select>
    </label>
  </section>

  <p class="dg3-note">Results are limited to the currently loaded page.</p>

  {#if controller.state === 'loading'}
    <div class="state-card" role="status">Loading contacts...</div>
  {:else if controller.state === 'error'}
    <div class="state-stack">
      <ErrorDetailsPanel
        title="Unable to load contacts"
        message={controller.error.message}
        details={controller.error.details}
        correlationId={controller.error.correlationId}
      />
      <button class="secondary" type="button" onclick={() => void controller.retry()}>Retry</button>
    </div>
  {:else if controller.state === 'empty'}
    <div class="state-card">
      <h3>No contacts found</h3>
      <p>There are no contacts on this page yet.</p>
      <button type="button" class="primary" onclick={() => void controller.navigateToNew()}>Create your first contact</button>
    </div>
    <Pagination
      page={controller.page}
      pageSize={controller.pageSize}
      totalCount={controller.totalCount}
      isBusy={controller.isBusy}
      onPageChange={(nextPage) => void controller.changePage(nextPage)}
      onPageSizeChange={(nextSize) => void controller.changePageSize(nextSize)}
    />
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if controller.filteredContacts.length === 0}
            <tr>
              <td colspan="5" class="no-match">No contacts match your search on this page.</td>
            </tr>
          {:else}
            {#each controller.filteredContacts as contact (contact.id)}
              <tr>
                <td>{contact.firstName} {contact.lastName}</td>
                <td>{contact.email ?? '—'}</td>
                <td>{contact.phone ?? '—'}</td>
                <td>{new Date(contact.updatedAt).toLocaleString()}</td>
                <td class="actions-cell">
                  <button type="button" class="ghost" onclick={() => void controller.navigateToDetails(contact.id)}>
                    View
                  </button>
                  <button type="button" class="ghost" onclick={() => void controller.navigateToEdit(contact.id)}>
                    Edit
                  </button>
                  <button type="button" class="danger" onclick={() => void controller.deleteFromList(contact)}>
                    Delete
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <Pagination
      page={controller.page}
      pageSize={controller.pageSize}
      totalCount={controller.totalCount}
      isBusy={controller.isBusy}
      onPageChange={(nextPage) => void controller.changePage(nextPage)}
      onPageSizeChange={(nextSize) => void controller.changePageSize(nextSize)}
    />
  {/if}
</section>

<style>
  .contacts-page {
    display: grid;
    gap: 0.9rem;
    padding-block: 0.6rem 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .page-header h2 {
    margin: 0;
  }

  .page-header p {
    margin: 0;
    color: hsl(var(--text) / 0.8);
  }

  .toolbar {
    display: grid;
    gap: 0.65rem;
    padding: 0.8rem;
    grid-template-columns: 1fr;
  }

  .field {
    display: grid;
    gap: 0.3rem;
  }

  .small {
    max-width: 16rem;
  }

  input,
  select,
  button {
    font: inherit;
  }

  input,
  select {
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface));
    color: hsl(var(--text));
    padding: 0.4rem 0.55rem;
  }

  .dg3-note {
    margin: 0;
    color: hsl(var(--text) / 0.78);
    font-size: 0.9rem;
  }

  .state-card,
  .state-stack {
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    background: hsl(var(--surface));
    padding: 0.9rem;
    display: grid;
    gap: 0.55rem;
  }

  .table-wrap {
    overflow: auto;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    background: hsl(var(--surface));
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 44rem;
  }

  th,
  td {
    text-align: left;
    border-bottom: 1px solid hsl(var(--border));
    padding: 0.55rem 0.6rem;
    vertical-align: top;
  }

  th {
    background: hsl(var(--surface-muted));
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .actions-cell {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .no-match {
    text-align: center;
    color: hsl(var(--text) / 0.75);
  }

  button {
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    padding: 0.35rem 0.62rem;
    cursor: pointer;
  }

  .primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  .secondary,
  .ghost {
    background: hsl(var(--surface-muted));
    border-color: hsl(var(--border));
    color: hsl(var(--text));
  }

  .danger {
    background: hsl(var(--danger));
    color: white;
  }

  @media (min-width: 860px) {
    .toolbar {
      grid-template-columns: 1fr auto;
      align-items: end;
    }
  }
</style>
