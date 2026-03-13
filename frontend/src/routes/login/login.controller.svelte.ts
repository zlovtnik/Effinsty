import { goto } from '$app/navigation';
import type { HTMLInputAttributes } from 'svelte/elements';
import { get, type Unsubscriber } from 'svelte/store';
import { login, type AuthTokens } from '$lib/api/auth';
import { isRequestError } from '$lib/api/errors';
import { extractReasonFromSearch, extractReturnToFromSearch } from '$lib/auth/navigation';
import { authStore } from '$lib/stores/auth.store';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { announce } from '$lib/utils/a11y';
import { trackAction, trackError } from '$lib/utils/telemetry';

export type State = 'idle' | 'loading' | 'success' | 'error';
export type FieldName = 'tenantId' | 'username' | 'password';

export interface LoginLibraryItem {
  name: string;
  href: string;
  summary: string;
}

export type LoginPrinciple = string;

export interface LoginFieldConfig {
  key: FieldName;
  id: string;
  name: string;
  label: string;
  type: 'text' | 'password';
  autocomplete: HTMLInputAttributes['autocomplete'];
}

export interface LoginFieldView extends LoginFieldConfig {
  value: string;
  error: string;
  errorId: string;
  delayIndex: number;
}

export interface LoginAlertView {
  message: string;
  details: string[];
  correlationId: string;
}

interface LoginFailureState {
  message: string;
  details: string[];
  correlationId: string;
}

type FieldErrors = Record<FieldName, string>;

interface UiStateView {
  submitLabel: string;
  isBusy: boolean;
  showAlert: boolean;
}

const UI_STATE_STRATEGY: Record<State, UiStateView> = {
  idle: { submitLabel: 'Sign in', isBusy: false, showAlert: false },
  loading: { submitLabel: 'Signing in...', isBusy: true, showAlert: false },
  success: { submitLabel: 'Signed in', isBusy: false, showAlert: false },
  error: { submitLabel: 'Sign in', isBusy: false, showAlert: true },
};

function emptyFieldErrors(): FieldErrors {
  return {
    tenantId: '',
    username: '',
    password: '',
  };
}

function createCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export class LoginController {
  readonly animationLibraries: readonly LoginLibraryItem[] = [
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

  readonly principles: readonly LoginPrinciple[] = [
    '120-180ms transitions for premium responsiveness',
    'Staggered entrances for visual hierarchy',
    'Keyed fades for clean state changes',
    'Reduced-motion support as a baseline',
  ];

  readonly fieldRegistry: readonly LoginFieldConfig[] = [
    {
      key: 'tenantId',
      id: 'tenant-id',
      name: 'tenant-id',
      label: 'Tenant ID',
      type: 'text',
      autocomplete: 'organization',
    },
    {
      key: 'username',
      id: 'username',
      name: 'username',
      label: 'Username',
      type: 'text',
      autocomplete: 'username',
    },
    {
      key: 'password',
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'current-password',
    },
  ];

  state = $state<State>('idle');
  tenantId = $state(get(tenantStore).tenantId ?? '');
  username = $state('');
  password = $state('');
  fieldErrors = $state<FieldErrors>(emptyFieldErrors());
  formError = $state('');
  formDetails = $state<string[]>([]);
  correlationId = $state('');
  liveMessage = $state('');
  routeMessage = $state('');
  alertKey = $state(0);
  private returnToPath = '/dashboard';

  uiView = $derived(UI_STATE_STRATEGY[this.state]);
  fields = $derived(
    this.fieldRegistry.map((field, index) => ({
      ...field,
      value: this.getFieldValue(field.key),
      error: this.fieldErrors[field.key],
      errorId: `${field.id}-error`,
      delayIndex: index + 1,
    }))
  );
  alertView = $derived({
    message: this.formError,
    details: this.formDetails,
    correlationId: this.correlationId,
  });

  mount(): Unsubscriber {
    this.hydrateRouteContext();

    return authStore.subscribe((state) => {
      if (state.isAuthenticated) {
        void goto(this.returnToPath);
      }
    });
  }

  updateField(field: FieldName, value: string): void {
    this.setFieldValue(field, value);

    if (this.fieldErrors[field]) {
      this.fieldErrors = { ...this.fieldErrors, [field]: '' };
    }

    if (this.state === 'error') {
      this.transitionTo('idle');
    }
  }

  async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.resetFeedback();

    if (!this.validateForm()) {
      this.applyValidationFailure();
      return;
    }

    const safeTenantId = this.tenantId.trim();
    const safeUsername = this.username.trim();
    const requestCorrelationId = createCorrelationId();

    this.beginLoginAttempt(safeTenantId);

    try {
      const tokens = await login(
        safeTenantId,
        { username: safeUsername, password: this.password },
        requestCorrelationId
      );

      this.completeLogin(safeTenantId, tokens);
      await goto(this.returnToPath);
    } catch (error) {
      this.failLogin(error, safeTenantId, requestCorrelationId);
    }
  }

  private transitionTo(state: State): void {
    this.state = state;
  }

  private resetFeedback(): void {
    this.formError = '';
    this.formDetails = [];
    this.correlationId = '';
    this.liveMessage = '';
    this.transitionTo('idle');
  }

  private beginLoginAttempt(tenantId: string): void {
    this.transitionTo('loading');
    this.routeMessage = '';
    authStore.startLogin();
    tenantStore.setTenant(tenantId);
    trackAction('login', {
      status: 'start',
      details: { tenantId },
    });
  }

  private completeLogin(tenantId: string, tokens: AuthTokens): void {
    this.transitionTo('success');
    authStore.completeLogin(tokens);
    sessionStore.setRefreshToken(tokens.refreshToken);
    tenantStore.resolveTenant(tenantId);
    trackAction('login', {
      status: 'success',
      details: { tenantId },
    });
    this.liveMessage = 'Signed in successfully. Redirecting to dashboard.';
    announce(this.liveMessage);
  }

  private failLogin(error: unknown, tenantId: string, requestCorrelationId: string): void {
    const failure = this.toLoginFailureState(error, requestCorrelationId);

    this.formError = failure.message;
    this.formDetails = failure.details;
    this.correlationId = failure.correlationId;
    this.liveMessage = failure.message;
    this.alertKey += 1;
    this.transitionTo('error');

    authStore.failLogin(failure.message);
    sessionStore.clear();

    if (isRequestError(error) && error.appError.kind === 'forbidden') {
      tenantStore.invalidateTenant(failure.message, tenantId);
    } else {
      tenantStore.setError(failure.message);
    }

    trackAction('login', {
      status: 'failure',
      message: failure.message,
      correlationId: failure.correlationId,
      details: { tenantId },
    });
    trackError('login_failure', {
      message: failure.message,
      details: failure.details,
      correlationId: failure.correlationId,
    });
    announce(failure.message, 'assertive');
  }

  private validateForm(): boolean {
    const nextErrors = emptyFieldErrors();

    if (!this.tenantId.trim()) nextErrors.tenantId = 'Tenant ID is required.';
    if (!this.username.trim()) nextErrors.username = 'Username is required.';
    if (!this.password.trim()) nextErrors.password = 'Password is required.';

    this.fieldErrors = nextErrors;
    return !Object.values(nextErrors).some(Boolean);
  }

  private applyValidationFailure(): void {
    const message = 'Please complete all required fields.';
    this.formError = message;
    this.liveMessage = message;
    this.transitionTo('error');
    announce(message, 'assertive');
  }

  private setFieldValue(field: FieldName, value: string): void {
    if (field === 'tenantId') this.tenantId = value;
    if (field === 'username') this.username = value;
    if (field === 'password') this.password = value;
  }

  private getFieldValue(field: FieldName): string {
    if (field === 'tenantId') return this.tenantId;
    if (field === 'username') return this.username;
    return this.password;
  }

  private toLoginFailureState(error: unknown, fallbackCorrelationId: string): LoginFailureState {
    let message = 'Unable to sign in.';
    let details: string[] = [];
    let correlationId = fallbackCorrelationId;

    if (isRequestError(error)) {
      message = error.appError.message;
      details = error.appError.details;
      correlationId = error.appError.correlationId || fallbackCorrelationId;
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }

    return { message, details, correlationId };
  }

  private hydrateRouteContext(): void {
    const search = globalThis.location?.search ?? '';

    this.returnToPath = extractReturnToFromSearch(search);
    const reason = extractReasonFromSearch(search);
    this.routeMessage = this.toRouteMessage(reason);
  }

  private toRouteMessage(reason: 'invalid-tenant' | 'session-expired' | null): string {
    if (reason === 'invalid-tenant') {
      return 'Tenant context is invalid. Sign in with a valid tenant ID.';
    }

    if (reason === 'session-expired') {
      return 'Your session expired. Sign in again to continue.';
    }

    return '';
  }
}
