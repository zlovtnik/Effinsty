<script lang="ts">
  import { tick } from 'svelte';
  import { uiStore } from '$lib/stores/ui.store';

  const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let dialogElement = $state<HTMLDivElement | null>(null);
  let previouslyFocusedElement: HTMLElement | null = null;
  let wasOpen = false;

  function cancel(): void {
    uiStore.resolveConfirmation(false);
  }

  function confirm(): void {
    uiStore.resolveConfirmation(true);
  }

  function getFocusableElements(): HTMLElement[] {
    if (!dialogElement) {
      return [];
    }

    return Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  async function focusDialogOnOpen(): Promise<void> {
    await tick();
    if (!dialogElement || !$uiStore.confirmModal.isOpen) {
      return;
    }

    const firstFocusable = getFocusableElements()[0] ?? dialogElement;
    firstFocusable.focus();
  }

  function restorePreviousFocus(): void {
    if (!previouslyFocusedElement) {
      return;
    }

    if (previouslyFocusedElement.isConnected) {
      previouslyFocusedElement.focus();
    }
    previouslyFocusedElement = null;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      cancel();
      return;
    }

    if (event.key !== 'Tab' || !dialogElement) {
      return;
    }

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogElement.focus();
      return;
    }

    const firstFocusable = focusableElements[0]!;
    const lastFocusable = focusableElements[focusableElements.length - 1]!;
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === dialogElement) {
        event.preventDefault();
        lastFocusable.focus();
      }
      return;
    }

    if (activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  $effect(() => {
    const isOpen = $uiStore.confirmModal.isOpen;

    if (isOpen && !wasOpen) {
      const activeElement = document.activeElement;
      previouslyFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
      void focusDialogOnOpen();
    }

    if (!isOpen && wasOpen) {
      restorePreviousFocus();
    }

    wasOpen = isOpen;
  });
</script>

{#if $uiStore.confirmModal.isOpen}
  <div class="overlay">
    <div
      class="dialog"
      bind:this={dialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      tabindex="0"
      onkeydown={handleKeydown}
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
    background: hsl(var(--overlay-muted));
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .dialog {
    width: min(92vw, 29rem);
    border-radius: var(--radius);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--card));
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
    color: hsl(var(--foreground) / 0.9);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  button {
    cursor: pointer;
    font: inherit;
    border-radius: calc(var(--radius) - 4px);
    padding: 0.4rem 0.7rem;
  }

  .secondary {
    border: 1px solid hsl(var(--border));
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

  .primary {
    border: 1px solid transparent;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  .danger {
    border: 1px solid transparent;
    background: hsl(var(--destructive));
    color: hsl(var(--destructive-foreground));
  }
</style>
