<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from './Button.svelte';
  import type { Snippet } from 'svelte';

  type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';

  interface Action {
    label: string;
    tone?: Tone;
    disabled?: boolean;
    onClick: () => void;
  }

  interface Props {
    isOpen: boolean;
    title: string;
    titleId?: string;
    description?: string;
    descriptionId?: string;
    onClose: () => void;
    initialFocus?: string;
    closeOnBackdrop?: boolean;
    actions?: Action[];
    className?: string;
    children: Snippet;
  }

  let {
    isOpen,
    title,
    titleId,
    description,
    descriptionId,
    onClose,
    initialFocus,
    closeOnBackdrop = true,
    actions,
    className = '',
    children,
  }: Props = $props();

  const instanceId = $state(
    Math.random().toString(36).slice(2, 8)
  );

  let modalRef = $state<HTMLElement | null>(null);
  let lastFocused: Element | null = $state(null);

  const fallbackTitleId = $derived(`ui-modal-title-${instanceId}`);
  const fallbackDescriptionId = $derived(`ui-modal-description-${instanceId}`);

  const resolvedTitleId = $derived(titleId || fallbackTitleId);
  const resolvedDescriptionId = $derived(descriptionId || (description ? fallbackDescriptionId : ''));

  const focusableSelector =
    'button, a, input, select, textarea, [tabindex]';

  function getFocusableNodes(): HTMLElement[] {
    if (!modalRef) {
      return [];
    }

    return Array.from(modalRef.querySelectorAll<HTMLElement>(focusableSelector)).filter((node) => {
      if (node.hasAttribute('disabled')) {
        return false;
      }

      const tabIndex = node.getAttribute('tabindex');
      if (tabIndex === '-1') {
        return false;
      }

      return true;
    });
  }

  function focusDefault(): void {
    if (!modalRef) {
      return;
    }

    if (initialFocus) {
      const target = modalRef.querySelector<HTMLElement>(`#${initialFocus}`);
      if (target) {
        target.focus();
        return;
      }
    }

    const focusable = getFocusableNodes()[0];
    focusable?.focus();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !modalRef) {
      return;
    }

    const focusableNodes = getFocusableNodes();
    if (focusableNodes.length === 0) {
      event.preventDefault();
      return;
    }

    const active = document.activeElement as HTMLElement;
    const activeIndex = focusableNodes.indexOf(active);
    if (activeIndex === -1) {
      return;
    }

    event.preventDefault();

    if (event.shiftKey && activeIndex === 0) {
      focusableNodes[focusableNodes.length - 1]?.focus();
      return;
    }

    if (event.shiftKey) {
      const prevIndex = activeIndex === 0 ? focusableNodes.length - 1 : activeIndex - 1;
      focusableNodes[prevIndex].focus();
      return;
    }

    const nextIndex = activeIndex === focusableNodes.length - 1 ? 0 : activeIndex + 1;
    focusableNodes[nextIndex].focus();
  }

  function closeFromBackdrop(event: MouseEvent): void {
    if (!closeOnBackdrop || event.target !== event.currentTarget) {
      return;
    }

    onClose();
  }

  $effect(() => {
    if (!isOpen) {
      return;
    }

    lastFocused = document.activeElement;
    const timeout = window.setTimeout(() => {
      focusDefault();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('keydown', onKeyDown);
      if (lastFocused instanceof HTMLElement && lastFocused.focus) {
        lastFocused.focus();
      }
    };
  });

  onDestroy(() => {
    if (lastFocused instanceof HTMLElement && lastFocused.focus) {
      lastFocused.focus();
    }
  });

  const classList = $derived(['ui-modal', className].filter(Boolean).join(' '));
  const ariaDescriptionId = $derived(description ? resolvedDescriptionId || undefined : undefined);
</script>

{#if isOpen}
  <div class="ui-modal__backdrop" onclick={closeFromBackdrop}>
    <section
      bind:this={modalRef}
      class={classList}
      role="dialog"
      aria-modal="true"
      aria-labelledby={resolvedTitleId}
      aria-describedby={ariaDescriptionId}
      tabindex="-1"
    >
      <header class="ui-modal__header">
        <h2 id={resolvedTitleId}>{title}</h2>
        <Button type="button" variant="ghost" size="sm" ariaLabel="Close dialog" onclick={onClose}>
          ✕
        </Button>
      </header>

      {#if description}
        <p id={resolvedDescriptionId} class="ui-modal__description">{description}</p>
      {/if}

      <div class="ui-modal__content">
        {@render children()}
      </div>

      {#if actions && actions.length > 0}
        <footer class="ui-modal__actions">
          {#each actions as action}
            <Button
              variant={action.tone ?? 'secondary'}
              disabled={action.disabled}
              onclick={action.onClick}
            >
              {action.label}
            </Button>
          {/each}
        </footer>
      {/if}
    </section>
  </div>
{/if}

<style>
  .ui-modal__backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: hsl(var(--overlay) / 0.45);
    padding: 1rem;
  }

  .ui-modal {
    width: min(100%, 32rem);
    background: hsl(var(--card));
    border-radius: var(--radius);
    border: 1px solid hsl(var(--border));
    box-shadow: var(--shadow-md);
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }

  .ui-modal__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
  }

  .ui-modal__description {
    margin: 0;
    color: hsl(var(--muted-foreground));
  }

  .ui-modal__content {
    display: grid;
    gap: 0.65rem;
  }

  .ui-modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  .ui-modal__header :global(button:focus-visible),
  .ui-modal__actions :global(button:focus-visible) {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .ui-modal {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-modal {
      animation: none;
    }
  }
</style>
