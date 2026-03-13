<script lang="ts">
  import { page } from '$app/stores';
</script>

<main>
  <h1>{$page.status}</h1>
  <p>{$page.error?.message ?? 'Unexpected error'}</p>
  {#if $page.error?.correlationId}
    <p>
      Correlation ID:
      <code>{$page.error.correlationId}</code>
    </p>
  {/if}
</main>
