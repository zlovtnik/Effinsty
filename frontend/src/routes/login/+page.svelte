<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { login } from '$lib/api/auth';
  import { authStore } from '$lib/stores/auth.store';
  import { tenantStore } from '$lib/stores/tenant.store';
  import { isRequestError } from '$lib/api/errors';
  import { announce } from '$lib/utils/a11y';
  import { track } from '$lib/utils/telemetry';
  import { attachHeroEnhancement } from '$lib/utils/motion-adapter';

  type FieldName = 'tenantId' | 'username' | 'password';

  const MOTION = {
    fast: 120,
    base: 180,
    stagger: 40,
  } as const;

  const animationLibraries = [
    {
      name: 'Motion.dev',
      href: 'https://motion.dev/',
      summary: 'Framework-agnostic motion engine for advanced gesture and layout effects.',
    },
    {
      name: 'Svelte Magic UI',
      href: 'https://www.sveltemagicui.com/',
      summary: 'Drop-in animated Svelte components with premium polish.',
    },
    {
      name: 'Svelte Aceternity UI',
      href: 'https://github.com/TheComputerM/awesome-svelte',
      summary: 'Flashier hero patterns such as moving borders and beams.',
    },
    {
      name: 'Ori-UI',
      href: 'https://sveltesociety.dev/?tags=ui-library',
      summary: 'Open-source component library for Svelte + TypeScript.',
    },
  ];

  const principles = [
    '120-180ms transitions for premium responsiveness',
    'Staggered entrances for visual hierarchy',
    'Keyed fades for clean state changes',
    'Reduced-motion support as a baseline',
  ];

  let tenantId = get(tenantStore).tenantId ?? '';
  let username = '';
  let password = '';
  let formError = '';
  let formDetails: string[] = [];
  let correlationId = '';
  let liveMessage = '';
  let alertKey = 0;

  let fieldErrors: Record<FieldName, string> = {
    tenantId: '',
    username: '',
    password: '',
  };

  onMount(() => {
    const unsubscribe = authStore.subscribe((state) => {
      if (state.isAuthenticated) {
        void goto('/dashboard');
      }
    });

    return () => unsubscribe();
  });

  function updateField(field: FieldName, value: string): void {
    if (field === 'tenantId') tenantId = value;
    if (field === 'username') username = value;
    if (field === 'password') password = value;

    if (fieldErrors[field]) {
      fieldErrors = { ...fieldErrors, [field]: '' };
    }
  }

  function createCorrelationId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function validateForm(): boolean {
    const nextErrors: Record<FieldName, string> = {
      tenantId: '',
      username: '',
      password: '',
    };

    if (!tenantId.trim()) nextErrors.tenantId = 'Tenant ID is required.';
    if (!username.trim()) nextErrors.username = 'Username is required.';
    if (!password.trim()) nextErrors.password = 'Password is required.';

    fieldErrors = nextErrors;
    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    formError = '';
    formDetails = [];
    correlationId = '';
    liveMessage = '';

    if (!validateForm()) {
      const message = 'Please complete all required fields.';
      formError = message;
      liveMessage = message;
      announce(message, 'assertive');
      return;
    }

    const safeTenantId = tenantId.trim();
    const safeUsername = username.trim();
    const requestCorrelationId = createCorrelationId();

    authStore.startLogin();
    tenantStore.setTenant(safeTenantId);
    track('login_attempt', { tenantId: safeTenantId });

    try {
      const tokens = await login(
        safeTenantId,
        { username: safeUsername, password },
        requestCorrelationId
      );

      authStore.completeLogin(tokens);
      track('login_success', { tenantId: safeTenantId });

      liveMessage = 'Signed in successfully. Redirecting to dashboard.';
      announce(liveMessage);
      await goto('/dashboard');
    } catch (error) {
      let message = 'Unable to sign in.';
      let details: string[] = [];
      let resolvedCorrelationId = requestCorrelationId;

      if (isRequestError(error)) {
        message = error.appError.message;
        details = error.appError.details;
        resolvedCorrelationId = error.appError.correlationId || requestCorrelationId;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      formError = message;
      formDetails = details;
      correlationId = resolvedCorrelationId;
      liveMessage = message;
      alertKey += 1;

      authStore.failLogin(message);
      track('login_failure', { tenantId: safeTenantId, correlationId: resolvedCorrelationId });
      announce(message, 'assertive');
    }
  }
</script>

<svelte:head>
  <title>Sign In | Effinsty</title>
</svelte:head>

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
        {#each principles as principle, index (principle)}
          <span
            class="chip"
            in:fade={{ duration: MOTION.base, delay: MOTION.stagger * index, easing: cubicOut }}
          >
            {principle}
          </span>
        {/each}
      </div>

      <ul class="library-list" aria-label="Animation libraries">
        {#each animationLibraries as item, index (item.name)}
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
        {/each}
      </ul>
    </div>
  </aside>

  <section class="login-panel" in:fly={{ y: 10, duration: MOTION.base, easing: cubicOut }}>
    <form class="login-card" on:submit={handleSubmit} novalidate aria-labelledby="login-title">
      <p class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

      <p class="eyebrow">Welcome back</p>
      <h2 id="login-title">Sign in to your workspace</h2>
      <p class="card-copy">Use tenant-scoped credentials to access your dashboard.</p>

      <div class="field-row" in:fly={{ y: 6, duration: MOTION.base, delay: MOTION.stagger, easing: cubicOut }}>
        <label for="tenant-id">Tenant ID</label>
        <input
          id="tenant-id"
          name="tenant-id"
          type="text"
          autocomplete="organization"
          value={tenantId}
          aria-invalid={Boolean(fieldErrors.tenantId)}
          aria-describedby={fieldErrors.tenantId ? 'tenant-id-error' : undefined}
          on:input={(event) => updateField('tenantId', (event.currentTarget as HTMLInputElement).value)}
          required
        />
        {#if fieldErrors.tenantId}
          <p id="tenant-id-error" class="field-error">{fieldErrors.tenantId}</p>
        {/if}
      </div>

      <div
        class="field-row"
        in:fly={{ y: 6, duration: MOTION.base, delay: MOTION.stagger * 2, easing: cubicOut }}
      >
        <label for="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autocomplete="username"
          value={username}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={fieldErrors.username ? 'username-error' : undefined}
          on:input={(event) => updateField('username', (event.currentTarget as HTMLInputElement).value)}
          required
        />
        {#if fieldErrors.username}
          <p id="username-error" class="field-error">{fieldErrors.username}</p>
        {/if}
      </div>

      <div
        class="field-row"
        in:fly={{ y: 6, duration: MOTION.base, delay: MOTION.stagger * 3, easing: cubicOut }}
      >
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          value={password}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          on:input={(event) => updateField('password', (event.currentTarget as HTMLInputElement).value)}
          required
        />
        {#if fieldErrors.password}
          <p id="password-error" class="field-error">{fieldErrors.password}</p>
        {/if}
      </div>

      {#if formError}
        {#key alertKey}
          <div
            class="form-alert"
            role="alert"
            in:fade={{ duration: MOTION.fast }}
            out:fade={{ duration: MOTION.fast }}
          >
            <p>{formError}</p>
            {#if formDetails.length > 0}
              <ul>
                {#each formDetails as detail}
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
          </div>
        {/key}
      {/if}

      <button class="submit-button" type="submit" disabled={$authStore.loading} aria-busy={$authStore.loading}>
        {$authStore.loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  </section>
</main>

<style>
  :global(body) {
    color: hsl(var(--text));
    background: hsl(var(--bg));
    font-family: Manrope, "Avenir Next", "Segoe UI", sans-serif;
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
    animation: pulseGlow 6s ease-in-out infinite;
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
    border-radius: var(--radius-md, 12px);
    padding: 0.75rem;
    background: hsl(var(--surface) / 0.96);
    box-shadow: var(--shadow-sm, 0 1px 2px hsl(222 47% 11% / 0.08));
    transition:
      transform var(--motion-fast, 120ms) ease,
      box-shadow var(--motion-fast, 120ms) ease;
  }

  .library-card:hover,
  .library-card:focus-within {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md, 0 8px 24px hsl(222 47% 11% / 0.1));
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
    border-radius: var(--radius-lg, 16px);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--surface) / 0.98);
    box-shadow: var(--shadow-md, 0 8px 24px hsl(222 47% 11% / 0.1));
    padding: clamp(1rem, 2.8vw, 1.75rem);
    display: grid;
    gap: 0.88rem;
  }

  .field-row {
    display: grid;
    gap: 0.35rem;
  }

  label {
    font-size: 0.9rem;
    font-weight: 700;
  }

  input {
    min-height: 44px;
    width: 100%;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid hsl(var(--border));
    padding: 0.6rem 0.72rem;
    font: inherit;
    color: hsl(var(--text));
    background: hsl(var(--surface));
    transition:
      border-color var(--motion-fast, 120ms) ease,
      box-shadow var(--motion-fast, 120ms) ease;
  }

  input:focus-visible {
    outline: none;
    border-color: hsl(var(--focus, var(--primary)));
    box-shadow: 0 0 0 3px hsl(var(--focus, var(--primary)) / 0.2);
  }

  .field-error {
    margin: 0;
    color: hsl(var(--danger, 0 84% 60%));
    font-size: 0.82rem;
  }

  .form-alert {
    border: 1px solid hsl(var(--danger, 0 84% 60%) / 0.4);
    background: hsl(var(--danger, 0 84% 60%) / 0.08);
    color: hsl(var(--text));
    border-radius: var(--radius-sm, 8px);
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
    font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;
    font-size: 0.78rem;
  }

  .submit-button {
    min-height: 44px;
    border: none;
    border-radius: var(--radius-md, 12px);
    font: inherit;
    font-weight: 700;
    color: hsl(var(--primary-foreground, 0 0% 100%));
    background: linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)));
    box-shadow: 0 8px 20px hsl(var(--primary) / 0.24);
    cursor: pointer;
    transition:
      transform var(--motion-fast, 120ms) ease,
      box-shadow var(--motion-fast, 120ms) ease,
      opacity var(--motion-fast, 120ms) ease;
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px hsl(var(--primary) / 0.3);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:focus-visible {
    outline: 3px solid hsl(var(--focus, var(--primary)) / 0.3);
    outline-offset: 2px;
  }

  .submit-button:disabled {
    cursor: not-allowed;
    opacity: 0.72;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
