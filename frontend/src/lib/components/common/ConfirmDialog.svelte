<script lang="ts">
  import { uiStore } from '$lib/stores/ui.store';

  function cancel(): void {
    uiStore.resolveConfirmation(false);
  }

  function confirm(): void {
    uiStore.resolveConfirmation(true);
  }
</script>

{#if $uiStore.confirmModal.isOpen}
  <div class="overlay">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      tabindex="0"
      onkeydown={(event) => {
        if (event.key === 'Escape') {
          cancel();
        }
      }}
    >
      <h2 id="confirm-title">{$uiStore.confirmModal.title}</h2>
      <p id="confirm-message">{$uiStore.confirmModal.message}</p>
      <div class="actions">
        <button type="button" class="secondary" onclick={cancel}>{$uiStore.confirmModal.cancelLabel}</button>
        <button
          type="button"
          class={$uiStore.confirmModal.tone === 'danger' ? 'danger' : 'primary'}
          onclick={confirm}
        >
          {$uiStore.confirmModal.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    z-index: 70;
    inset: 0;
    background: hsl(222 47% 11% / 0.36);
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .dialog {
    width: min(92vw, 29rem);
    border-radius: var(--radius-lg);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface));
    box-shadow: var(--shadow-md);
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
  }

  .dialog h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .dialog p {
    margin: 0;
    color: hsl(var(--text) / 0.9);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  button {
    cursor: pointer;
    font: inherit;
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.7rem;
  }

  .secondary {
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
  }

  .primary {
    border: 1px solid transparent;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  .danger {
    border: 1px solid transparent;
    background: hsl(var(--danger));
    color: white;
  }
</style>
