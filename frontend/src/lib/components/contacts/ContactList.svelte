<script lang="ts">
  import type { ContactResponse } from '$lib/api/contacts';
  import type { ContactsSortKey } from '$lib/contacts/listing';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';

  type ContactListState = 'loading' | 'ready' | 'empty' | 'error';

  interface Props {
    state: ContactListState;
    isBusy?: boolean;
    filteredContacts: ContactResponse[];
    errorMessage?: string;
    errorDetails?: string[];
    errorCorrelationId?: string;
    page: number;
    pageSize: number;
    totalCount: number;
    search: string;
    searchLabel: string;
    sortKey: ContactsSortKey;
    onSearch: (value: string) => void;
    onSort: (value: ContactsSortKey) => void;
    onRetry: () => Promise<void> | void;
    onCreate: () => Promise<void> | void;
    onPageChange: (page: number) => Promise<void> | void;
    onPageSizeChange: (size: number) => Promise<void> | void;
    onView: (id: string) => Promise<void> | void;
    onEdit: (id: string) => Promise<void> | void;
    onDelete: (contact: ContactResponse) => Promise<void> | void;
  }

  const SORT_OPTIONS: Array<{ value: ContactsSortKey; label: string }> = [
    { value: 'updated_desc', label: 'Recently updated' },
    { value: 'name_asc', label: 'Name A-Z' },
    { value: 'name_desc', label: 'Name Z-A' },
  ];

  let {
    state,
    isBusy = false,
    filteredContacts,
    errorMessage = '',
    errorDetails = [],
    errorCorrelationId = '',
    page,
    pageSize,
    totalCount,
    search,
    searchLabel,
    sortKey,
    onSearch,
    onSort,
    onRetry,
    onCreate,
    onPageChange,
    onPageSizeChange,
    onView,
    onEdit,
    onDelete,
  }: Props = $props();
</script>

{#snippet createFirstContactSnippet()}
  <Button type="button" variant="primary" onclick={() => void onCreate()}>
    Create your first contact
  </Button>
{/snippet}

<section class="contacts-page container-page" aria-busy={isBusy}>
  <header class="page-header">
    <div>
      <h2>Contacts</h2>
      <p>Browse contacts with backend paging and page-scoped filtering.</p>
    </div>
    <Button type="button" variant="primary" onclick={() => void onCreate()}>
      New contact
    </Button>
  </header>

  <section class="toolbar surface-card">
    <Field id="contacts-search" label={searchLabel}>
      <Input
        id="contacts-search"
        type="search"
        placeholder="Search this page of contacts"
        value={search}
        oninput={(event) => onSearch((event.currentTarget as HTMLInputElement).value)}
      />
    </Field>

    <Field id="contacts-sort" label="Sort">
      <select
        id="contacts-sort"
        class="sort-select"
        value={sortKey}
        onchange={(event) => onSort((event.currentTarget as HTMLSelectElement).value as ContactsSortKey)}
      >
        {#each SORT_OPTIONS as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </Field>
  </section>

  <p class="dg3-note">Results are limited to the currently loaded page.</p>

  {#if state === 'loading'}
    <div class="loading-shell" role="status" aria-live="polite">
      <div class="surface-card state-card">
        <Skeleton lines={2} compact={true} />
      </div>
      <div class="surface-card state-card">
        <Skeleton lines={2} />
      </div>
      <div class="surface-card state-card">
        <Skeleton lines={8} />
      </div>
      <div class="surface-card state-card">
        <Skeleton lines={2} compact={true} />
      </div>
    </div>
  {:else if state === 'error'}
    <div class="state-stack">
      <Alert
        title="Unable to load contacts"
        message={errorMessage}
        details={errorDetails}
        correlationId={errorCorrelationId}
        tone="danger"
        role="alert"
      />
      <Button type="button" variant="secondary" onclick={() => void onRetry()}>
        Retry
      </Button>
    </div>
  {:else if state === 'empty'}
    <div class="empty-state-wrap">
      <EmptyState title="No contacts found" message="There are no contacts on this page yet." ctaSlot={createFirstContactSnippet} />
    </div>

    <Pagination
      {page}
      {pageSize}
      {totalCount}
      {isBusy}
      onPageChange={(nextPage) => void onPageChange(nextPage)}
      onPageSizeChange={(nextSize) => void onPageSizeChange(nextSize)}
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
          {#if filteredContacts.length === 0}
            <tr>
              <td colspan="5" class="no-match">No contacts match your search on this page.</td>
            </tr>
          {:else}
            {#each filteredContacts as contact (contact.id)}
              <tr>
                <td>{contact.firstName} {contact.lastName}</td>
                <td>{contact.email ?? '—'}</td>
                <td>{contact.phone ?? '—'}</td>
                <td>{new Date(contact.updatedAt).toLocaleString()}</td>
                <td class="actions-cell">
                  <Button type="button" variant="secondary" onclick={() => void onView(contact.id)}>
                    View
                  </Button>
                  <Button type="button" variant="secondary" onclick={() => void onEdit(contact.id)}>
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onclick={() => void onDelete(contact)}>
                    Delete
                  </Button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <Pagination
      {page}
      {pageSize}
      {totalCount}
      {isBusy}
      onPageChange={(nextPage) => void onPageChange(nextPage)}
      onPageSizeChange={(nextSize) => void onPageSizeChange(nextSize)}
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
    color: hsl(var(--foreground) / 0.8);
  }

  .toolbar {
    display: grid;
    gap: 0.65rem;
    padding: 0.8rem;
    grid-template-columns: 1fr;
  }

  .state-card,
  .state-stack {
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px);
    background: hsl(var(--card));
    padding: 0.9rem;
    display: grid;
    gap: 0.55rem;
  }

  .loading-shell {
    display: grid;
    gap: 0.75rem;
  }

  .table-wrap {
    overflow: auto;
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px);
    background: hsl(var(--card));
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
    background: hsl(var(--muted));
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .actions-cell {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .dg3-note {
    margin: 0;
    color: hsl(var(--foreground) / 0.78);
    font-size: 0.9rem;
  }

  .no-match {
    text-align: center;
    color: hsl(var(--foreground) / 0.75);
  }

  .sort-select {
    border-radius: calc(var(--radius) - 4px);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--card));
    color: hsl(var(--foreground));
    padding: 0.35rem 0.55rem;
    font: inherit;
    min-height: 34px;
  }

  .empty-state-wrap {
    display: grid;
    gap: 0.5rem;
  }
</style>
