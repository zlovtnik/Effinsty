<script lang="ts">
  type AlertTone = 'info' | 'danger';
  type AlertRole = 'alert' | 'status';

  interface Props {
    title?: string;
    message: string;
    details?: string[];
    correlationId?: string;
    tone?: AlertTone;
    role?: AlertRole;
    className?: string;
  }

  let {
    title,
    message,
    details = [],
    correlationId = '',
    tone = 'info',
    role = 'alert',
    className = '',
  }: Props = $props();

  const alertClass = $derived(['ui-alert', `ui-alert--${tone}`, className].filter(Boolean).join(' '));
</script>

<section class={alertClass} {role}>
  {#if title}
    <h3>{title}</h3>
  {/if}

  <p>{message}</p>

  {#if details.length > 0}
    <ul>
      {#each details as detail}
        <li>{detail}</li>
      {/each}
    </ul>
  {/if}

  {#if correlationId}
    <p class="ui-alert__correlation">
      Correlation ID:
      <code>{correlationId}</code>
    </p>
  {/if}
</section>

<style>
  .ui-alert {
    border-radius: var(--radius-md);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text));
    padding: 0.9rem;
    display: grid;
    gap: 0.5rem;
  }

  .ui-alert--danger {
    border-color: hsl(var(--danger) / 0.3);
    background: hsl(var(--danger) / 0.08);
  }

  .ui-alert--info {
    color: hsl(var(--text) / 0.88);
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  p,
  ul {
    margin: 0;
  }

  ul {
    padding-left: 1.1rem;
    display: grid;
    gap: 0.25rem;
  }

  .ui-alert__correlation {
    font-size: 0.85rem;
    color: hsl(var(--text) / 0.85);
  }

  code {
    font-family: var(--font-family-mono);
    background: hsl(var(--surface));
    border: 1px solid hsl(var(--border));
    border-radius: 5px;
    padding: 0.08rem 0.35rem;
  }
</style>
