<script lang="ts">
  import Button from './Button.svelte';

  type ToastType = 'success' | 'error' | 'info' | 'warning';

  interface Props {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    onDismiss: (id: string) => void;
  }

  let { id, type, title, message, onDismiss }: Props = $props();
</script>

<article class={`ui-toast ui-toast--${type}`}>
  <div class="ui-toast__content">
    {#if title}
      <strong class="ui-toast__title">{title}</strong>
    {/if}
    <p>{message}</p>
  </div>

  <Button variant="ghost" size="sm" onclick={() => onDismiss(id)} ariaLabel={`Dismiss ${title ?? 'notification'}`}>
    Dismiss
  </Button>
</article>

<style>
  .ui-toast {
    border-radius: var(--radius-md);
    border: 1px solid hsl(var(--border));
    box-shadow: var(--shadow-md);
    background: hsl(var(--surface));
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 0.85rem;
    padding: 0.8rem 0.9rem;
  }

  .ui-toast__content {
    display: grid;
    gap: 0.2rem;
  }

  .ui-toast__title {
    font-size: 0.85rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .ui-toast__content p {
    margin: 0;
  }

  .ui-toast--success {
    border-left: 4px solid hsl(var(--success));
  }

  .ui-toast--error {
    border-left: 4px solid hsl(var(--danger));
  }

  .ui-toast--warning {
    border-left: 4px solid hsl(var(--warning));
  }

  .ui-toast--info {
    border-left: 4px solid hsl(var(--info));
  }
</style>
