<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'size' | 'class'> {
    error?: boolean;
    className?: string;
    describedBy?: string;
  }

  let {
    id,
    name,
    type = 'text',
    value = '',
    placeholder = '',
    required = false,
    disabled = false,
    readonly = false,
    error = false,
    className,
    describedBy,
    ...attrs
  }: Props = $props();

  const baseClass = $derived(
    ['ui-input', error ? 'is-error' : '', className || '']
      .filter(Boolean)
      .join(' ')
  );
</script>

<input
  {id}
  {name}
  {type}
  {value}
  {placeholder}
  {required}
  {disabled}
  {readonly}
  aria-invalid={error || undefined}
  aria-describedby={describedBy || undefined}
  class={baseClass}
  {...attrs}
/>

<style>
  .ui-input {
    width: 100%;
    min-height: 44px;
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

  .ui-input:focus-visible {
    outline: none;
    border-color: hsl(var(--focus));
    box-shadow: var(--focus-ring);
  }

  .ui-input.is-error {
    border-color: hsl(var(--danger));
  }

  .ui-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
