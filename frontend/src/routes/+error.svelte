<script lang="ts">
  import { page } from '$app/stores';
</script>

<main>
  <h1>{$page.status}</h1>
  <p>{$page.error?.message ?? 'Unexpected error'}</p>
</main>
