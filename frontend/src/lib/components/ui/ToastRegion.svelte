<script lang="ts">
  import { uiStore } from '$lib/stores/ui.store';
  import Toast from './Toast.svelte';

  function dismiss(id: string): void {
    uiStore.dismissNotification(id);
  }
</script>

<div class="ui-toast-region" aria-live="polite" aria-atomic="false">
  {#each $uiStore.notifications as toast (toast.id)}
    <Toast
      id={toast.id}
      type={toast.type}
      message={toast.message}
      onDismiss={dismiss}
    />
  {/each}
</div>

<style>
  .ui-toast-region {
    position: fixed;
    z-index: 60;
    right: 1rem;
    bottom: 1rem;
    display: grid;
    gap: 0.65rem;
    width: min(92vw, 28rem);
  }

  @media (max-width: 640px) {
    .ui-toast-region {
      left: 0.8rem;
      right: 0.8rem;
      bottom: 0.8rem;
      width: auto;
    }
  }
</style>
