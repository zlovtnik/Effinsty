<script lang="ts">
  interface Props {
    message: string;
    details?: string[];
    correlationId?: string;
    title?: string;
  }

  let {
    message,
    details = [],
    correlationId = '',
    title = 'Request failed',
  }: Props = $props();
</script>

<section class="error-panel" role="alert">
  <h3>{title}</h3>
  <p>{message}</p>

  {#if details.length > 0}
    <ul>
      {#each details as detail}
        <li>{detail}</li>
      {/each}
    </ul>
  {/if}

  {#if correlationId}
    <p class="correlation">
      Correlation ID:
      <code>{correlationId}</code>
    </p>
  {/if}
</section>

<style>
  .error-panel {
    border-radius: var(--radius-md);
    border: 1px solid hsl(var(--danger) / 0.3);
    background: hsl(var(--danger) / 0.08);
    color: hsl(var(--text));
    padding: 0.9rem;
    display: grid;
    gap: 0.5rem;
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
  }

  .correlation {
    font-size: 0.85rem;
    color: hsl(var(--text) / 0.85);
  }

  code {
    font-family: 'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace;
    background: hsl(var(--surface-muted));
    border: 1px solid hsl(var(--border));
    border-radius: 5px;
    padding: 0.08rem 0.35rem;
  }
</style>
