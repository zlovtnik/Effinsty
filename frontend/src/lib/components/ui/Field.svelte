<script lang="ts">
  interface Props {
    label: string;
    id: string;
    required?: boolean;
    hint?: string;
    error?: string;
    describedBy?: string;
    className?: string;
    children: import('svelte').Snippet;
  }

  let {
    label,
    id,
    required = false,
    hint,
    error = '',
    describedBy = '',
    className = '',
    children,
  }: Props = $props();

  const hintId = $derived(`${id}-hint`);
  const errorId = $derived(`${id}-error`);

  const ariaIds = $derived([hint ? hintId : '', error ? errorId : '', describedBy].filter(Boolean).join(' '));
  const fieldClass = $derived(['ui-field', error ? 'is-error' : '', className].filter(Boolean).join(' '));
  let controlRef = $state<HTMLDivElement | null>(null);

  function mergeAriaIds(existing: string, extra: string): string {
    return Array.from(new Set([...existing.split(/\s+/), ...extra.split(/\s+/)].filter(Boolean))).join(' ');
  }

  $effect(() => {
    if (!controlRef) {
      return;
    }

    const control = controlRef.querySelector<HTMLElement>('input, select, textarea');
    if (!control) {
      return;
    }

    if (!control.dataset.fieldBaseDescribedBy) {
      control.dataset.fieldBaseDescribedBy = control.getAttribute('aria-describedby') ?? '';
    }

    const merged = mergeAriaIds(control.dataset.fieldBaseDescribedBy, ariaIds);
    if (merged) {
      control.setAttribute('aria-describedby', merged);
      return;
    }

    control.removeAttribute('aria-describedby');
  });
</script>

<div class={fieldClass}>
  <label for={id}>
    <span>{label}</span>
    {#if required}
      <span class="ui-field__required" aria-hidden="true">*</span>
      <span class="sr-only">required</span>
    {/if}
  </label>

  <div class="ui-field__control" bind:this={controlRef}>
    {@render children()}
  </div>

  {#if hint}
    <p id={hintId} class="ui-field__hint">{hint}</p>
  {/if}

  {#if error}
    <p id={errorId} role="alert" class="ui-field__error">{error}</p>
  {/if}
</div>

<style>
  .ui-field {
    display: grid;
    gap: 0.35rem;
    width: 100%;
  }

  .ui-field > label {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.92rem;
    font-weight: 600;
  }

  .ui-field__required {
    color: hsl(var(--danger));
  }

  .ui-field__control :global(input),
  .ui-field__control :global(select),
  .ui-field__control :global(textarea) {
    min-height: 44px;
    width: 100%;
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    padding: 0.45rem 0.55rem;
    background: hsl(var(--surface));
    color: hsl(var(--text));
    font: inherit;
    transition:
      border-color var(--motion-fast) var(--motion-ease-standard),
      box-shadow var(--motion-fast) var(--motion-ease-standard);
  }

  .is-error :global(input),
  .is-error :global(select),
  .is-error :global(textarea) {
    border-color: hsl(var(--danger));
  }

  .ui-field__control :global(input:focus-visible),
  .ui-field__control :global(select:focus-visible),
  .ui-field__control :global(textarea:focus-visible) {
    outline: none;
    border-color: hsl(var(--focus));
    box-shadow: var(--focus-ring);
  }

  .ui-field__hint {
    margin: 0;
    color: hsl(var(--text-muted));
    font-size: 0.84rem;
  }

  .ui-field__error {
    margin: 0;
    color: hsl(var(--danger));
    font-size: 0.84rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-field__control :global(input),
    .ui-field__control :global(select),
    .ui-field__control :global(textarea) {
      transition: none;
    }
  }
</style>
