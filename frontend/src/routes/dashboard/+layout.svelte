<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { get } from 'svelte/store';
  import { buildLoginRedirectPath, currentPathWithQuery } from '$lib/auth/navigation';
  import { logoutCurrentSession } from '$lib/api/authenticated';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
  import ToastRegion from '$lib/components/common/ToastRegion.svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { healthStore } from '$lib/stores/health.store';
  import { tenantStore } from '$lib/stores/tenant.store';
  import { trackAction } from '$lib/utils/telemetry';

  interface DashboardLayoutProps {
    children?: Snippet;
  }

  let { children }: DashboardLayoutProps = $props();
  let isSigningOut = $state(false);

  function formatCheckedAt(timestamp: number | null): string {
    if (!timestamp) {
      return 'Pending check';
    }

    return new Date(timestamp).toLocaleTimeString();
  }

  function enforceGuard(): void {
    const authState = get(authStore);
    const currentPath = currentPathWithQuery();

    if (!authState.isAuthenticated) {
      void goto(buildLoginRedirectPath(currentPath));
      return;
    }

    const tenantState = get(tenantStore);
    if (!tenantState.tenantId || tenantState.status !== 'resolved') {
      void goto(buildLoginRedirectPath(currentPath, 'invalid-tenant'));
    }
  }

  function syncHealthPolling(): void {
    const authState = get(authStore);

    if (authState.isAuthenticated) {
      healthStore.startPolling();
      return;
    }

    healthStore.reset();
  }

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    isSigningOut = true;

    try {
      trackAction('signout_click', { status: 'start' });
      await logoutCurrentSession();
      await goto('/login');
    } finally {
      isSigningOut = false;
    }
  }

  onMount(() => {
    enforceGuard();
    syncHealthPolling();
    const unsubAuth = authStore.subscribe(() => enforceGuard());
    const unsubAuthHealth = authStore.subscribe(() => syncHealthPolling());
    const unsubTenant = tenantStore.subscribe(() => enforceGuard());

    return () => {
      unsubAuth();
      unsubAuthHealth();
      unsubTenant();
    };
  });

  onDestroy(() => {
    healthStore.stopPolling();
  });
</script>

<main class="dashboard-shell">
  <header class="shell-header">
    <div class="shell-header__title">
      <h1>Dashboard Shell</h1>
      <div class={`health-badge health-badge--${$healthStore.state}`} aria-live="polite">
        <span class="health-badge__dot"></span>
        <span>
          {$healthStore.state === 'healthy'
            ? 'API healthy'
            : $healthStore.state === 'degraded'
              ? 'API degraded'
              : 'Health pending'}
        </span>
      </div>
      <p class="health-meta">
        Checked {formatCheckedAt($healthStore.checkedAt)}
        {#if $healthStore.correlationId}
          · <code>{$healthStore.correlationId}</code>
        {/if}
      </p>
      {#if $healthStore.state === 'degraded' && $healthStore.message}
        <p class="health-message">{$healthStore.message}</p>
      {/if}
    </div>
    <button class="signout-button" type="button" onclick={() => void handleSignOut()} disabled={isSigningOut}>
      {isSigningOut ? 'Signing out...' : 'Sign out'}
    </button>
  </header>
  {@render children?.()}
</main>
<ConfirmDialog />
<ToastRegion />

<style>
  .dashboard-shell {
    padding: 1rem;
  }

  .shell-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .shell-header__title {
    display: grid;
    gap: 0.25rem;
  }

  .shell-header__title h1,
  .health-meta,
  .health-message {
    margin: 0;
  }

  .health-badge {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface));
  }

  .health-badge__dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: hsl(var(--text-muted));
  }

  .health-badge--healthy {
    border-color: hsl(var(--success) / 0.35);
    background: hsl(var(--success) / 0.12);
  }

  .health-badge--healthy .health-badge__dot {
    background: hsl(var(--success));
  }

  .health-badge--degraded {
    border-color: hsl(var(--warning) / 0.4);
    background: hsl(var(--warning) / 0.12);
  }

  .health-badge--degraded .health-badge__dot {
    background: hsl(var(--warning));
  }

  .health-meta,
  .health-message {
    color: hsl(var(--text) / 0.75);
    font-size: 0.85rem;
  }

  .signout-button {
    background: hsl(var(--surface));
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
    color: hsl(var(--text));
    cursor: pointer;
    font: inherit;
    padding: 0.45rem 0.8rem;
  }

  .signout-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }
</style>
