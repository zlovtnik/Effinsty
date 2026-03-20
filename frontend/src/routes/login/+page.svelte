<script lang="ts">
  import { onMount } from 'svelte';
  import LoginForm from '$lib/components/forms/LoginForm.svelte';
  import LoginHero from '$lib/components/layout/LoginHero.svelte';
  import { LoginController } from './login.controller.svelte';

  const controller = new LoginController();

  onMount(() => controller.mount());
</script>

<svelte:head>
  <title>Sign In | Effinsty</title>
</svelte:head>

<main class="login-shell">
  <LoginHero principles={controller.principles} animationLibraries={controller.animationLibraries} />
  <LoginForm
    fields={controller.fields}
    liveMessage={controller.liveMessage}
    routeMessage={controller.routeMessage}
    submitLabel={controller.uiView.submitLabel}
    isBusy={controller.uiView.isBusy}
    showAlert={controller.uiView.showAlert}
    alertView={controller.alertView}
    onFieldChange={(field, value) => controller.updateField(field, value)}
    onSubmit={(event) => controller.handleSubmit(event)}
  />
</main>

<style>
  :global(body) {
    color: hsl(var(--foreground));
    background: hsl(var(--background));
    font-family: var(--font-family-sans);
  }

  .login-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr;
    background:
      radial-gradient(90rem 40rem at 8% -10%, hsl(var(--primary) / 0.12), transparent),
      radial-gradient(80rem 36rem at 95% 6%, hsl(var(--accent) / 0.09), transparent),
      hsl(var(--background));
  }

  @media (min-width: 1024px) {
    .login-shell {
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    }
  }
</style>
