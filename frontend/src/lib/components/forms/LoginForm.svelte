<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import type { FieldName, LoginAlertView, LoginFieldView } from '$lib/auth/login-view';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  interface Props {
    fields: LoginFieldView[];
    liveMessage?: string;
    routeMessage?: string;
    submitLabel?: string;
    isBusy?: boolean;
    showAlert?: boolean;
    alertView?: LoginAlertView;
    onFieldChange: (field: FieldName, value: string) => void;
    onSubmit: (event: SubmitEvent) => Promise<void> | void;
  }

  const MOTION = {
    fast: 120,
    base: 180,
    stagger: 40,
  } as const;

  let {
    fields,
    liveMessage = '',
    routeMessage = '',
    submitLabel = 'Sign in',
    isBusy = false,
    showAlert = false,
    alertView = {
      message: '',
      details: [],
      correlationId: '',
    },
    onFieldChange,
    onSubmit,
  }: Props = $props();
</script>

<section class="login-panel" in:fly={{ y: 10, duration: MOTION.base, easing: cubicOut }}>
  <form class="login-card" onsubmit={(event) => void onSubmit(event as SubmitEvent)} novalidate aria-labelledby="login-title">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

    <p class="eyebrow">Welcome back</p>
    <h2 id="login-title">Sign in to your workspace</h2>
    <p class="card-copy">Use tenant-scoped credentials to access your dashboard.</p>

    {#if routeMessage}
      <Alert role="status" tone="info" message={routeMessage} className="context-alert" />
    {/if}

    {#each fields as field (field.key)}
      <div in:fade={{ duration: MOTION.base, delay: MOTION.stagger * field.delayIndex, easing: cubicOut }}>
        <Field label={field.label} id={field.id} required error={field.error}>
          <Input
            id={field.id}
            name={field.name}
            type={field.type}
            autocomplete={field.autocomplete}
            value={field.value}
            required
            error={Boolean(field.error)}
            describedBy={field.error ? field.errorId : undefined}
            oninput={(event) => onFieldChange(field.key, (event.currentTarget as HTMLInputElement).value)}
          />
        </Field>
      </div>
    {/each}

    {#if showAlert && alertView.message}
      <div in:fade={{ duration: MOTION.fast }} out:fade={{ duration: MOTION.fast }}>
        <Alert
          role="alert"
          tone="danger"
          message={alertView.message}
          details={alertView.details}
          correlationId={alertView.correlationId}
          className="form-alert"
        />
      </div>
    {/if}

    <Button
      type="submit"
      variant="primary"
      size="lg"
      loading={isBusy}
      disabled={isBusy}
      aria-busy={isBusy}
      className="submit-button"
    >
      {submitLabel}
    </Button>
  </form>
</section>

<style>
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

  .eyebrow {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--text) / 0.7);
  }

  h2 {
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-size: clamp(1.15rem, 2.5vw, 1.55rem);
  }

  .card-copy {
    margin: 0;
    color: hsl(var(--text) / 0.8);
    line-height: 1.5;
  }

  :global(.context-alert) {
    padding: 0.7rem 0.8rem;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  :global(.form-alert) {
    padding: 0.72rem;
  }

  :global(.submit-button) {
    align-self: end;
    font-weight: 700;
    min-height: 44px;
    margin-top: 0.2rem;
    background: linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)));
    box-shadow: 0 8px 20px hsl(var(--primary) / 0.24);
  }

  :global(.submit-button:hover:not(:disabled)) {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px hsl(var(--primary) / 0.3);
  }

  :global(.submit-button:active:not(:disabled)) {
    transform: translateY(0);
  }

  :global(.submit-button:focus-visible) {
    outline: 3px solid hsl(var(--focus) / 0.3);
    outline-offset: 2px;
  }

  @media (min-width: 768px) {
    .login-panel {
      padding: 1.5rem;
    }
  }

  @media (min-width: 1024px) {
    .login-panel {
      min-height: 100vh;
      padding: 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.submit-button),
    :global(.ui-input) {
      transition: none;
    }
  }
</style>
