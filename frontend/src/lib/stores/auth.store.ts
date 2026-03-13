import { get, writable } from 'svelte/store';
import { RequestError, toConfigurationError } from '$lib/api/errors';
import {
  presentError,
  SESSION_CONTEXT_ERROR_MESSAGE,
  type PresentedError,
} from '$lib/services/error/error-presenter';
import {
  authService,
  type AuthService,
  type AuthTokens,
  type LoginRequest,
} from '$lib/services/auth/auth.service';
import { sessionStore } from '$lib/stores/session.store';
import { tenantStore } from '$lib/stores/tenant.store';
import { trackAction, trackError } from '$lib/utils/telemetry';

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  expiresAt: null,
  loading: false,
  error: null,
};

export interface AuthRequestContext {
  tenantId: string;
  accessToken: string;
}

export interface AuthStoreDependencies {
  authService?: AuthService;
  sessionStore?: typeof sessionStore;
  tenantStore?: typeof tenantStore;
}

export function createAuthStore(dependencies: AuthStoreDependencies = {}) {
  const authServiceImpl = dependencies.authService ?? authService;
  const sessionStoreImpl = dependencies.sessionStore ?? sessionStore;
  const tenantStoreImpl = dependencies.tenantStore ?? tenantStore;
  const { subscribe, set, update } = writable<AuthState>(initialState);
  let refreshInFlight: Promise<string> | null = null;

  function getState(): AuthState {
    return get({ subscribe });
  }

  function trackRefreshFailure(error: PresentedError, tenantId?: string | null): void {
    trackError('session_refresh_failure', {
      message: error.message,
      statusCode: undefined,
      details: error.details,
      correlationId: error.correlationId,
    });
    trackAction('session_refresh', {
      status: 'failure',
      message: 'Session refresh failed.',
      details: { tenantId: tenantId ?? undefined },
    });
  }

  return {
    subscribe,
    startLogin: () =>
      update((state) => ({
        ...state,
        loading: true,
        error: null,
      })),
    completeLogin: (session: AuthTokens) => {
      sessionStoreImpl.setTokens(session);
      set({
        isAuthenticated: true,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        loading: false,
        error: null,
      });
    },
    setSession: (accessToken: string, expiresAt: string) => {
      sessionStoreImpl.setAccessToken(accessToken, expiresAt);
      set({
        isAuthenticated: true,
        accessToken,
        expiresAt,
        loading: false,
        error: null,
      });
    },
    failLogin: (message: string) =>
      set({
        ...initialState,
        loading: false,
        error: message,
      }),
    reset: () => set(initialState),
    getRequestContext(message = SESSION_CONTEXT_ERROR_MESSAGE): AuthRequestContext {
      const state = getState();
      const tenantState = get(tenantStoreImpl);

      if (!state.accessToken || !tenantState.tenantId || tenantState.status !== 'resolved') {
        throw new RequestError(toConfigurationError(message));
      }

      return {
        tenantId: tenantState.tenantId,
        accessToken: state.accessToken,
      };
    },
    async login(
      tenantId: string,
      credentials: LoginRequest,
      correlationId?: string
    ): Promise<AuthTokens> {
      update((state) => ({
        ...state,
        loading: true,
        error: null,
      }));
      tenantStoreImpl.setTenant(tenantId);
      trackAction('login', {
        status: 'start',
        details: { tenantId },
      });

      try {
        const session = await authServiceImpl.login(tenantId, credentials, correlationId);
        sessionStoreImpl.setTokens(session);
        tenantStoreImpl.resolveTenant(tenantId);
        set({
          isAuthenticated: true,
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          loading: false,
          error: null,
        });
        trackAction('login', {
          status: 'success',
          details: { tenantId },
        });
        return session;
      } catch (error) {
        const presented = presentError(error, {
          fallbackMessage: 'Unable to sign in.',
          fallbackCorrelationId: correlationId,
        });
        set({
          ...initialState,
          loading: false,
          error: presented.message,
        });
        sessionStoreImpl.clear();
        tenantStoreImpl.applyPresentedError(presented, tenantId);
        trackAction('login', {
          status: 'failure',
          message: presented.message,
          correlationId: presented.correlationId,
          details: { tenantId },
        });
        trackError('login_failure', {
          message: presented.message,
          details: presented.details,
          correlationId: presented.correlationId,
        });
        throw error;
      }
    },
    async refresh(correlationId?: string): Promise<string> {
      const tenantId = get(tenantStoreImpl).tenantId;
      const refreshToken = sessionStoreImpl.getSession().refreshToken;

      if (!tenantId || !refreshToken) {
        const error = new RequestError(
          toConfigurationError(
            'Cannot refresh session: refresh token is not available in memory.'
          )
        );
        trackRefreshFailure(presentError(error), tenantId);
        throw error;
      }

      if (!refreshInFlight) {
        refreshInFlight = (async () => {
          trackAction('session_refresh', {
            status: 'start',
            details: { tenantId },
          });

          try {
            const next = await authServiceImpl.refresh(
              tenantId,
              { refreshToken },
              correlationId
            );
            sessionStoreImpl.setTokens(next);
            tenantStoreImpl.resolveTenant(tenantId);
            set({
              isAuthenticated: true,
              accessToken: next.accessToken,
              expiresAt: next.expiresAt,
              loading: false,
              error: null,
            });
            trackAction('session_refresh', {
              status: 'success',
              details: { tenantId },
            });
            return next.accessToken;
          } catch (error) {
            trackRefreshFailure(
              presentError(error, {
                fallbackMessage: 'Session refresh failed.',
                fallbackCorrelationId: correlationId,
              }),
              tenantId
            );
            throw error;
          } finally {
            refreshInFlight = null;
          }
        })();
      }

      return refreshInFlight;
    },
    async logout(correlationId?: string): Promise<void> {
      const state = getState();
      const tenantId = get(tenantStoreImpl).tenantId;
      const refreshToken = sessionStoreImpl.getSession().refreshToken;

      try {
        trackAction('logout', {
          status: 'start',
          details: { tenantId: tenantId ?? undefined },
        });

        if (tenantId && state.accessToken && refreshToken) {
          await authServiceImpl.logout(
            tenantId,
            { refreshToken },
            state.accessToken,
            correlationId
          );
        }

        trackAction('logout', {
          status: 'success',
          details: { tenantId: tenantId ?? undefined },
        });
      } catch (error) {
        const presented = presentError(error, {
          fallbackMessage: 'Unable to sign out.',
          fallbackCorrelationId: correlationId,
        });
        trackAction('logout', {
          status: 'failure',
          message: presented.message,
          correlationId: presented.correlationId,
          details: { tenantId: tenantId ?? undefined },
        });
        throw error;
      } finally {
        set(initialState);
        sessionStoreImpl.clear();
        tenantStoreImpl.clear();
      }
    },
  };
}

export const authStore = createAuthStore();
