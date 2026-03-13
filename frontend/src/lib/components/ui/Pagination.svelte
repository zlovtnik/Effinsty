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

  const safePageSize = $derived(Math.max(1, pageSize));
  const totalPages = $derived(Math.max(1, Math.ceil(totalCount / safePageSize)));
  const isPreviousDisabled = $derived(isBusy || page <= 1);
  const isNextDisabled = $derived(isBusy || page >= totalPages);
  const instanceId = $state(
    Math.random().toString(36).slice(2, 10)
  );
  const summaryId = $derived(`ui-pagination-${instanceId}-summary`);
  const pageSizeId = $derived(`ui-pagination-${instanceId}-pagesize`);

  function previous(): void {
    if (isPreviousDisabled) {
      return;
    }

    onPageChange(page - 1);
  }

  function next(): void {
    if (isNextDisabled) {
      return;
    }

    onPageChange(page + 1);
  }
</script>

<nav class="ui-pagination" aria-label="Pagination controls">
  <p class="ui-pagination__summary" id={summaryId}>Page {page} of {totalPages}</p>

  <div class="ui-pagination__controls">
    <label for={pageSizeId} class="ui-pagination__label">
        Page size
        <select
        id={pageSizeId}
        aria-describedby={summaryId}
        value={String(pageSize)}
        disabled={isBusy}
        onchange={(event) => onPageSizeChange(Number((event.currentTarget as HTMLSelectElement).value))}
      >
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </label>

    <button
      type="button"
      class="ui-pagination__button"
      onclick={previous}
      disabled={isPreviousDisabled}
      aria-label={isPreviousDisabled ? 'Previous page' : `Go to previous page, page ${page - 1}`}
    >
      Previous
    </button>
    <button
      type="button"
      class="ui-pagination__button"
      onclick={next}
      disabled={isNextDisabled}
      aria-label={isNextDisabled ? 'Next page' : `Go to next page, page ${page + 1}`}
    >
      Next
    </button>
  </div>
</nav>

<style>
  .ui-pagination {
    display: grid;
    gap: 0.6rem;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    padding: 0.75rem;
    background: hsl(var(--surface));
  }

  .ui-pagination__summary {
    margin: 0;
    color: hsl(var(--text));
    opacity: 0.9;
  }

  .ui-pagination__controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .ui-pagination__label {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.88rem;
  }

  .ui-pagination select,
  .ui-pagination__button {
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
    padding: 0.35rem 0.55rem;
    font: inherit;
    transition:
      transform var(--motion-fast) var(--motion-ease-standard),
      box-shadow var(--motion-fast) var(--motion-ease-standard),
      opacity var(--motion-fast) var(--motion-ease-standard);
  }

  .ui-pagination__button {
    cursor: pointer;
    min-height: 36px;
  }

  .ui-pagination__button:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .ui-pagination select:focus-visible,
  .ui-pagination button:focus-visible {
    outline: 2px solid hsl(var(--focus));
    outline-offset: 2px;
  }

  .ui-pagination__button:hover:not(:disabled),
  .ui-pagination select:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-pagination__button,
    select {
      transition: none;
      transform: none;
    }
  }
</style>
