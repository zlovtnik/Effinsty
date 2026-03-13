<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { attachHeroEnhancement } from '$lib/utils/motion-adapter';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import {
    LoginController,
    type LoginAlertView,
    type LoginFieldView,
    type LoginLibraryItem,
    type LoginPrinciple,
  } from './login.controller.svelte';

  interface LoginPageProps {
    fieldSnippet?: Snippet<[LoginFieldView]>;
    alertSnippet?: Snippet<[LoginAlertView]>;
    principleSnippet?: Snippet<[LoginPrinciple, number]>;
    librarySnippet?: Snippet<[LoginLibraryItem, number]>;
  }

  let { fieldSnippet, alertSnippet, principleSnippet, librarySnippet }: LoginPageProps = $props();

  const MOTION = {
    fast: 120,
    base: 180,
    stagger: 40,
  } as const;
  const controller = new LoginController();

  onMount(() => controller.mount());
</script>

<svelte:head>
  <title>Sign In | Effinsty</title>
</svelte:head>

{#snippet defaultPrincipleSnippet(principle: LoginPrinciple, index: number)}
  <span class="chip" in:fade={{ duration: MOTION.base, delay: MOTION.stagger * index, easing: cubicOut }}>
    {principle}
  </span>
{/snippet}

{#snippet defaultLibrarySnippet(item: LoginLibraryItem, index: number)}
  <li
    class="library-card"
    in:fly={{
      y: 8,
      duration: MOTION.base,
      delay: MOTION.stagger * (index + 1),
      easing: cubicOut,
    }}
  >
    <a href={item.href} target="_blank" rel="noopener noreferrer">{item.name}</a>
    <p>{item.summary}</p>
  </li>
{/snippet}

{#snippet defaultFieldSnippet(field: LoginFieldView)}
  <Field label={field.label} id={field.id} required error={field.error}>
    <Input
      id={field.id}
      name={field.name}
      type={field.type}
      autocomplete={field.autocomplete}
      value={field.value}
      required
      oninput={(event) =>
        controller.updateField(field.key, (event.currentTarget as HTMLInputElement).value)}
      aria-invalid={Boolean(field.error)}
      aria-describedby={field.error ? field.errorId : undefined}
    />
  </Field>
{/snippet}

{#snippet defaultAlertSnippet(alert: LoginAlertView)}
  <div class="form-alert" role="alert" in:fade={{ duration: MOTION.fast }} out:fade={{ duration: MOTION.fast }}>
    <p>{alert.message}</p>
    {#if alert.details.length > 0}
      <ul>
        {#each alert.details as detail}
          <li>{detail}</li>
        {/each}
      </ul>
    {/if}
    {#if alert.correlationId}
      <p class="correlation">
        Correlation ID:
        <code>{alert.correlationId}</code>
      </p>
    {/if}
  </div>
{/snippet}

<main class="login-shell">
  <aside
    class="hero-panel"
    use:attachHeroEnhancement={{ enabled: false }}
    in:fly={{ y: 10, duration: MOTION.base, easing: cubicOut }}
  >
    <div class="hero-content">
      <p class="eyebrow">Effinsty Frontend</p>
      <h1>Animated Svelte login tuned for 2026 standards.</h1>
      <p class="hero-copy">
        Svelte 5 with Runes keeps motion lightweight and responsive. This screen uses subtle interaction
        patterns focused on clarity, speed, and accessibility.
      </p>

      <div class="principle-grid" aria-label="Motion principles">
        {#each controller.principles as principle, index (principle)}
          {#if principleSnippet}
            {@render principleSnippet(principle, index)}
          {:else}
            {@render defaultPrincipleSnippet(principle, index)}
          {/if}
        {/each}
      </div>

      <ul class="library-list" aria-label="Animation libraries">
        {#each controller.animationLibraries as item, index (item.name)}
          {#if librarySnippet}
            {@render librarySnippet(item, index)}
          {:else}
            {@render defaultLibrarySnippet(item, index)}
          {/if}
        {/each}
      </ul>
    </div>
  </aside>

  <section class="login-panel" in:fly={{ y: 10, duration: MOTION.base, easing: cubicOut }}>
    <form
      class="login-card"
      onsubmit={(event) => void controller.handleSubmit(event as SubmitEvent)}
      novalidate
      aria-labelledby="login-title"
    >
      <p class="sr-only" aria-live="polite" aria-atomic="true">{controller.liveMessage}</p>

      <p class="eyebrow">Welcome back</p>
      <h2 id="login-title">Sign in to your workspace</h2>
      <p class="card-copy">Use tenant-scoped credentials to access your dashboard.</p>

      {#if controller.routeMessage}
        <div class="context-alert" role="status">{controller.routeMessage}</div>
      {/if}

      {#each controller.fields as field (field.key)}
        {#if fieldSnippet}
          {@render fieldSnippet(field)}
        {:else}
          {@render defaultFieldSnippet(field)}
        {/if}
      {/each}

      {#if controller.uiView.showAlert}
        {#key controller.alertKey}
          {#if alertSnippet}
            {@render alertSnippet(controller.alertView)}
          {:else}
            {@render defaultAlertSnippet(controller.alertView)}
          {/if}
        {/key}
      {/if}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={controller.uiView.isBusy}
        disabled={controller.uiView.isBusy}
        aria-busy={controller.uiView.isBusy}
        className="submit-button"
      >
        {controller.uiView.submitLabel}
      </Button>
    </form>
  </section>
</main>

<style>
  :global(body) {
    color: hsl(var(--text));
    background: hsl(var(--bg));
    font-family: var(--font-family-sans);
  }

  .login-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr;
    background:
      radial-gradient(90rem 40rem at 8% -10%, hsl(var(--primary) / 0.12), transparent),
      radial-gradient(80rem 36rem at 95% 6%, hsl(var(--accent) / 0.09), transparent),
      hsl(var(--bg));
  }

  .hero-panel {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid hsl(var(--border));
    background: linear-gradient(145deg, hsl(var(--surface)), hsl(var(--surface) / 0.88));
  }

  .hero-panel::before {
    content: "";
    position: absolute;
    width: 24rem;
    height: 24rem;
    right: -7rem;
    bottom: -8rem;
    border-radius: 999px;
    background: radial-gradient(circle, hsl(var(--primary) / 0.2), transparent 70%);
    filter: blur(10px);
    animation: pulseGlow 6s var(--motion-ease-standard) infinite;
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    display: grid;
    gap: 1rem;
    padding: clamp(1.2rem, 4vw, 2.4rem);
  }

  .eyebrow {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--text) / 0.7);
  }

  h1,
  h2 {
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  h1 {
    font-size: clamp(1.35rem, 4vw, 2.2rem);
  }

  h2 {
    font-size: clamp(1.15rem, 2.5vw, 1.55rem);
  }

  .hero-copy,
  .card-copy {
    margin: 0;
    color: hsl(var(--text) / 0.8);
    line-height: 1.5;
  }

  .context-alert {
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface-muted));
    color: hsl(var(--text) / 0.85);
    margin: 0;
    padding: 0.7rem 0.8rem;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .principle-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    border-radius: 999px;
    border: 1px solid hsl(var(--border));
    padding: 0.38rem 0.66rem;
    font-size: 0.78rem;
    background: hsl(var(--surface) / 0.95);
  }

  .library-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.72rem;
  }

  .library-card {
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    padding: 0.75rem;
    background: hsl(var(--surface) / 0.96);
    box-shadow: var(--shadow-sm);
    transition:
      transform var(--motion-fast) var(--motion-ease-standard),
      box-shadow var(--motion-fast) var(--motion-ease-standard);
  }

  .library-card:hover,
  .library-card:focus-within {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .library-card a {
    color: hsl(var(--primary));
    font-weight: 700;
    text-decoration: none;
  }

  .library-card a:hover,
  .library-card a:focus-visible {
    text-decoration: underline;
  }

  .library-card p {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: hsl(var(--text) / 0.78);
  }

  .login-panel {
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .login-card {
    width: min(100%, 28rem);
    border-radius: var(--radius-lg);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface) / 0.98);
    box-shadow: var(--shadow-md);
    padding: clamp(1rem, 2.8vw, 1.75rem);
    display: grid;
    gap: 0.88rem;
  }

  .form-alert {
    border: 1px solid hsl(var(--danger) / 0.4);
    background: hsl(var(--danger) / 0.08);
    color: hsl(var(--text));
    border-radius: var(--radius-sm);
    padding: 0.72rem;
    display: grid;
    gap: 0.42rem;
  }

  .form-alert p {
    margin: 0;
  }

  .form-alert ul {
    margin: 0;
    padding-left: 1rem;
    display: grid;
    gap: 0.2rem;
  }

  .correlation {
    font-size: 0.8rem;
    color: hsl(var(--text) / 0.75);
  }

  .correlation code {
    font-family: var(--font-family-mono);
    font-size: 0.78rem;
  }

  .submit-button {
    align-self: end;
    font-weight: 700;
    min-height: 44px;
    margin-top: 0.2rem;
    background: linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)));
    box-shadow: 0 8px 20px hsl(var(--primary) / 0.24);
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px hsl(var(--primary) / 0.3);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:focus-visible {
    outline: 3px solid hsl(var(--focus) / 0.3);
    outline-offset: 2px;
  }

  @media (min-width: 768px) {
    .login-panel {
      padding: 1.5rem;
    }
  }

  @media (min-width: 1024px) {
    .login-shell {
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    }

    .hero-panel {
      border-bottom: none;
      border-right: 1px solid hsl(var(--border));
    }

    .hero-content {
      max-width: 44rem;
      margin-inline: auto;
      align-content: center;
      min-height: 100vh;
      padding-inline: clamp(2rem, 5vw, 4rem);
    }

    .login-panel {
      min-height: 100vh;
      padding: 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-panel::before {
      animation: none;
    }

    .library-card,
    input,
    .submit-button {
      transition: none;
    }
  }

  @keyframes pulseGlow {
    0% {
      transform: scale(1);
      opacity: 0.4;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.6;
    }
    100% {
      transform: scale(1);
      opacity: 0.4;
    }
  }
</style>
