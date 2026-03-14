import { goto } from '$app/navigation';
import { get, type Unsubscriber } from 'svelte/store';
import { extractReasonFromSearch, extractReturnToFromSearch } from '$lib/auth/navigation';
import type {
  FieldName,
  LoginFieldConfig,
  LoginLibraryItem,
  LoginPrinciple,
  State,
} from '$lib/auth/login-view';
import { presentError } from '$lib/services/error/error-presenter';
import { validateLoginFields } from '$lib/services/validation/validators';
import { authStore } from '$lib/stores/auth.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { announce } from '$lib/utils/a11y';

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

    this.beginLoginAttempt();

    try {
      await authStore.login(safeTenantId, {
        username: safeUsername,
        password: this.password,
      });
      this.completeLogin();
    } catch (error) {
      this.failLogin(error);
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

  private beginLoginAttempt(): void {
    this.transitionTo('loading');
    this.routeMessage = '';
  }

  private completeLogin(): void {
    this.transitionTo('success');
    this.liveMessage = 'Signed in successfully. Redirecting to dashboard.';
    announce(this.liveMessage);
  }

  private failLogin(error: unknown): void {
    const failure = this.toLoginFailureState(error);

    this.formError = failure.message;
    this.formDetails = failure.details;
    this.correlationId = failure.correlationId;
    this.liveMessage = failure.message;
    this.alertKey += 1;
    this.transitionTo('error');
    announce(failure.message, 'assertive');
  }

  private validateForm(): boolean {
    const result = validateLoginFields({
      tenantId: this.tenantId,
      username: this.username,
      password: this.password,
    });

    this.fieldErrors = result.fieldErrors;
    return result.isValid;
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

  private toLoginFailureState(error: unknown): LoginFailureState {
    return presentError(error, {
      fallbackMessage: 'Unable to sign in.',
    });
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
