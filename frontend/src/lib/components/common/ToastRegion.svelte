<script lang="ts">
  import { uiStore } from '$lib/stores/ui.store';

  const typeToLabel = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    warning: 'Warning',
  } as const;

  function dismiss(id: string): void {
    uiStore.dismissNotification(id);
  }
</script>

  <div class="toast-region" aria-live="polite" aria-atomic="false">
  {#each $uiStore.notifications as toast (toast.id)}
    <article class={`toast toast-${toast.type}`} role="status">
      <div class="toast-content">
        <strong>{typeToLabel[toast.type]}</strong>
        <p>{toast.message}</p>
        {#if toast.correlationId}
          <p class="toast-correlation">
            Correlation ID:
            <code>{toast.correlationId}</code>
          </p>
        {/if}
      </div>
      <button type="button" class="toast-dismiss" onclick={() => dismiss(toast.id)} aria-label="Dismiss notification">
        Dismiss
      </button>
    </article>
  {/each}
</div>

<style>
  .toast-region {
    position: fixed;
    z-index: 60;
    right: 1rem;
    bottom: 1rem;
    display: grid;
    gap: 0.65rem;
    width: min(92vw, 28rem);
  }

  .toast {
    border-radius: var(--radius-md);
    border: 1px solid hsl(var(--border));
    box-shadow: var(--shadow-md);
    background: hsl(var(--surface));
    display: flex;
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.8rem 0.9rem;
  }

  .toast-content {
    display: grid;
    gap: 0.2rem;
  }

  .toast-content strong {
    font-size: 0.85rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .toast-content p {
    margin: 0;
    font-size: 0.95rem;
  }

  .toast-correlation {
    font-size: 0.8rem;
    color: hsl(var(--text) / 0.75);
  }

  code {
    font-family: var(--font-family-mono, monospace);
  }

  .toast-dismiss {
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
    border-radius: var(--radius-sm);
    padding: 0.2rem 0.55rem;
    align-self: start;
    cursor: pointer;
  }

  .toast-success {
    border-left: 4px solid hsl(var(--success));
  }

  .toast-error {
    border-left: 4px solid hsl(var(--danger));
  }

  .toast-warning {
    border-left: 4px solid hsl(var(--warning));
  }

  .toast-info {
    border-left: 4px solid hsl(var(--info));
  }

  @media (max-width: 640px) {
    .toast-region {
      left: 0.8rem;
      right: 0.8rem;
      bottom: 0.8rem;
      width: auto;
    }
  }
</style>
