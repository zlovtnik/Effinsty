<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { get } from 'svelte/store';
  import { buildLoginRedirectPath, currentPathWithQuery } from '$lib/auth/navigation';
  import { logoutCurrentSession } from '$lib/api/authenticated';
  import { authStore } from '$lib/stores/auth.store';
  import { tenantStore } from '$lib/stores/tenant.store';

  interface DashboardLayoutProps {
    children?: Snippet;
  }

  let { children }: DashboardLayoutProps = $props();
  let isSigningOut = $state(false);

  function enforceGuard(): void {
    const authState = get(authStore);
    const currentPath = currentPathWithQuery();

    if (!authState.isAuthenticated || !authState.accessToken) {
      void goto(buildLoginRedirectPath(currentPath));
      return;
    }

    const tenantState = get(tenantStore);
    if (!tenantState.tenantId || tenantState.status !== 'resolved') {
      void goto(buildLoginRedirectPath(currentPath, 'invalid-tenant'));
    }
  }

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    isSigningOut = true;

    try {
      await logoutCurrentSession();
      await goto('/login');
    } finally {
      isSigningOut = false;
    }
  }

  onMount(() => {
    enforceGuard();
    const unsubAuth = authStore.subscribe(() => enforceGuard());
    const unsubTenant = tenantStore.subscribe(() => enforceGuard());

    return () => {
      unsubAuth();
      unsubTenant();
    };
  });
</script>

<main class="dashboard-shell">
  <header class="shell-header">
    <h1>Dashboard Shell</h1>
    <button class="signout-button" type="button" onclick={() => void handleSignOut()} disabled={isSigningOut}>
      {isSigningOut ? 'Signing out...' : 'Sign out'}
    </button>
  </header>
  {@render children?.()}
</main>

<style>
  .dashboard-shell {
    padding: 1rem;
  }

  .shell-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
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
