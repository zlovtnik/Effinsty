<script lang="ts">
  interface Props {
    page: number;
    pageSize: number;
    totalCount: number;
    isBusy?: boolean;
    onPageChange: (nextPage: number) => void;
    onPageSizeChange: (nextPageSize: number) => void;
  }

  let {
    page,
    pageSize,
    totalCount,
    isBusy = false,
    onPageChange,
    onPageSizeChange,
  }: Props = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(totalCount / pageSize)));

  function previous(): void {
    if (page <= 1 || isBusy) {
      return;
    }

    onPageChange(page - 1);
  }

  function next(): void {
    if (page >= totalPages || isBusy) {
      return;
    }

    onPageChange(page + 1);
  }
</script>

<nav class="pagination" aria-label="Contacts pagination">
  <div class="summary">
    <strong>Page {page}</strong>
    <span>of {totalPages}</span>
    <span>{totalCount} total contacts</span>
  </div>

  <div class="controls">
    <label>
      Page size
      <select
        value={String(pageSize)}
        disabled={isBusy}
        on:change={(event) => onPageSizeChange(Number((event.currentTarget as HTMLSelectElement).value))}
      >
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </label>

    <button type="button" on:click={previous} disabled={isBusy || page <= 1}>Previous</button>
    <button type="button" on:click={next} disabled={isBusy || page >= totalPages}>Next</button>
  </div>
</nav>

<style>
  .pagination {
    display: grid;
    gap: 0.6rem;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    padding: 0.75rem;
    background: hsl(var(--surface));
  }

  .summary {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    color: hsl(var(--text) / 0.85);
    align-items: baseline;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  select,
  button {
    font: inherit;
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
    padding: 0.35rem 0.55rem;
  }

  button {
    cursor: pointer;
  }

  button:disabled,
  select:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
</style>
