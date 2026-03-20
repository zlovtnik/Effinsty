<script lang="ts">
  interface Props {
    title: string;
    message?: string;
    ctaText?: string;
    ctaSlot?: import('svelte').Snippet;
  }

  let {
    title,
    message,
    ctaText,
    ctaSlot,
  }: Props = $props();
</script>

<section class="ui-empty-state" aria-live="polite">
  <h3>{title}</h3>
  {#if message}
    <p>{message}</p>
  {/if}

  {#if ctaSlot}
    <div class="ui-empty-state__cta">
      {@render ctaSlot()}
    </div>
  {:else if ctaText}
    <p>{ctaText}</p>
  {/if}
</section>

<style>
  .ui-empty-state {
    border: 1px dashed hsl(var(--border));
    border-radius: calc(var(--radius) - 2px);
    background: hsl(var(--card));
    padding: 1rem;
    display: grid;
    gap: 0.42rem;
  }

  .ui-empty-state h3 {
    margin: 0;
    font-size: 1rem;
  }

  .ui-empty-state p {
    margin: 0;
    color: hsl(var(--muted-foreground));
  }

  .ui-empty-state__cta {
    margin-top: 0.35rem;
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
</style>
