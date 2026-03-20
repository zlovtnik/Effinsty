<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
  type ButtonSize = 'sm' | 'md' | 'lg';

  interface Props extends Omit<HTMLButtonAttributes, 'class' | 'size' | 'variant'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    ariaLabel?: string;
    className?: string;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    ariaLabel,
    className = '',
    children,
    disabled = false,
    ...attrs
  }: Props & { children: import('svelte').Snippet } = $props();

  const buttonClass = $derived(
    ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, loading ? 'ui-button--loading' : '', className]
      .filter(Boolean)
      .join(' ')
  );
</script>

<button
  {type}
  class={buttonClass}
  disabled={disabled || loading}
  aria-busy={loading}
  aria-label={ariaLabel}
  {...attrs}
>
  <span class="ui-button__content">
    {#if loading}
      <span class="ui-button__loader" aria-hidden="true">⟳</span>
    {/if}
    <span>
      {@render children()}
    </span>
  </span>
</button>

<style>
  .ui-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: calc(var(--radius) - 4px);
    border: 1px solid transparent;
    padding: 0.45rem 0.9rem;
    min-height: 44px;
    font: inherit;
    cursor: pointer;
    transition:
      transform var(--motion-fast) var(--motion-ease-standard),
      box-shadow var(--motion-fast) var(--motion-ease-standard),
      opacity var(--motion-fast) var(--motion-ease-standard);
    white-space: nowrap;
  }

  .ui-button:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
    box-shadow: 0 0 0 3px hsl(var(--ring) / 0.25);
  }

  .ui-button:disabled,
  .ui-button[aria-busy='true'] {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .ui-button--sm {
    min-height: 34px;
    padding: 0.25rem 0.65rem;
  }

  .ui-button--lg {
    min-height: 48px;
    padding: 0.65rem 1.05rem;
  }

  .ui-button--primary {
    color: hsl(var(--primary-foreground));
    background: hsl(var(--primary));
    border-color: hsl(var(--primary));
  }

  .ui-button--secondary {
    color: hsl(var(--foreground));
    background: hsl(var(--muted));
    border-color: hsl(var(--border));
  }

  .ui-button--ghost {
    color: hsl(var(--foreground));
    background: transparent;
    border-color: transparent;
  }

  .ui-button--danger {
    color: hsl(var(--destructive-foreground));
    background: hsl(var(--destructive));
    border-color: hsl(var(--destructive));
  }

  .ui-button--danger-outline {
    background: transparent;
    color: hsl(var(--destructive));
    border-color: hsl(var(--destructive));
  }

  .ui-button--loading {
    pointer-events: none;
  }

  .ui-button:hover:not(:disabled):not([aria-busy='true']) {
    transform: translateY(-1px);
  }

  .ui-button__content {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .ui-button__loader {
    display: inline-block;
    animation: ui-button-spin 0.8s linear infinite;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-button,
    .ui-button__loader {
      transition: none;
      animation: none;
      transform: none;
    }
  }

  @keyframes ui-button-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
