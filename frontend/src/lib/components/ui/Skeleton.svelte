<script lang="ts">
  interface Props {
    lines?: number;
    compact?: boolean;
  }

  let { lines = 4, compact = false }: Props = $props();

  const widths = $derived(Array.from({ length: lines }, (_, index) => {
    if (compact) {
      return index === 0 ? 35 : 100;
    }

    return 100;
  }));
</script>

<div class="ui-skeleton" aria-hidden="true" data-testid="ui-skeleton">
  {#each widths as width, index}
    <span class={`ui-skeleton__line ui-skeleton__line--${index === 0 ? 'first' : 'default'}`} style={`width: ${width}%`}></span>
  {/each}
</div>

<style>
  .ui-skeleton {
    display: grid;
    gap: 0.6rem;
    padding: 0.15rem 0;
  }

  .ui-skeleton__line {
    display: block;
    height: 0.85rem;
    border-radius: 999px;
    background: linear-gradient(90deg, color-mix(in srgb, hsl(var(--muted-foreground)) 16%, transparent), transparent);
    background-size: 200% 100%;
    animation: ui-skeleton 1.2s linear infinite;
    opacity: 0.65;
  }

  .ui-skeleton__line--first {
    height: 1.05rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-skeleton__line {
      animation: none;
      background-position: 0 0;
      opacity: 0.4;
    }
  }

  @keyframes ui-skeleton {
    from {
      background-position: 100% 0;
    }

    to {
      background-position: 0 0;
    }
  }
</style>
