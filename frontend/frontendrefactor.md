# Effinsty Frontend - Comprehensive Refactor Specification

**Version:** 1.1  
**Date:** 2026-03-12  
**Status:** Roadmap + In-Progress Implementation (Login Headless Controller + FSM applied)  
**Target Health:** ⭐⭐⭐⭐⭐ (Modular, Testable, Maintainable)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Layer Refactoring Plan](#layer-refactoring-plan)
5. [Component Decomposition](#component-decomposition)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### The Problem

Your codebase currently exhibits **3-4 levels of complexity** where **1-2 levels** is sustainable:

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Max Component LOC** | 380 | 100 | -280 |
| **Monolithic Functions** | 6+ | 0 | Eliminate |
| **Abstraction Layers** | 2 | 5 | +3 needed |
| **Code Duplication** | 3-4x | 0 | Consolidate |
| **Service Layer** | None | ✓ Required | Add |
| **Error Mapping** | Inline | Centralized | Refactor |

### The Root Causes

1. **No Domain/Service Layer** → Components call API directly
2. **No Form Abstraction** → Validation + submission logic in component
3. **No Error Context** → Error mapping scattered across codebase
4. **Partial Authentication Orchestrator** → Login route is orchestrated; token lifecycle is still ad-hoc app-wide
5. **No Query/Command Pattern** → Business intent implicit
6. **No Composition Utilities** → Reusable patterns locked in components

### The Solution

A **5-layer architecture** with clear separation of concerns:

```
UI Layer (Svelte Components)
    ↓
Feature/Page Layer (Route Logic)
    ↓
Domain/Service Layer (Business Logic)
    ↓
Query/Command Layer (Intent Objects)
    ↓
Infrastructure Layer (HTTP, Storage)
```

### Current Implementation Snapshot (Actual Codebase)

#### ✅ Implemented (Login Route Refactor)

- Added headless controller: `src/routes/login/login.controller.svelte.ts`
- Refactored `src/routes/login/+page.svelte` to a pure view that consumes controller properties/methods
- Moved reactive state + orchestration into class methods using Svelte 5 runes (`$state`, `$derived`)
- Introduced FSM state model:
  - `type State = 'idle' | 'loading' | 'success' | 'error'`
  - Single source of truth: `state`
  - Derived UI view via strategy map (`UI_STATE_STRATEGY`) and `uiView = $derived(...)`
- Added explicit transition methods (`transitionTo`, `beginLoginAttempt`, `completeLogin`, `failLogin`, `applyValidationFailure`)
- Replaced repeated field and alert markup with typed snippet blocks and snippet injection via `$props()`:
  - `fieldSnippet`, `alertSnippet`, `principleSnippet`, `librarySnippet`

#### Notes

- This removes impossible UI combinations such as simultaneous loading and error/success rendering because visual state is derived from one FSM state value.
- Existing login route tests still pass after refactor.

---

## Current State Analysis

### 1. Complexity Hotspots

#### 🟢 Implemented Update: login/+page.svelte + login.controller.svelte.ts

**Resolved:**
- Form state management moved out of template into `LoginController`
- Validation and submission orchestration moved into explicit controller methods
- UI state now driven by FSM (`idle | loading | success | error`)
- Derived UI strategy map replaces ad-hoc conditional button/alert logic
- Repeating template blocks abstracted into typed snippets

**Current Impact:** Much lower coupling; view is now pluggable and orchestration is testable as headless logic

```typescript
// Current: Single-source UI state via FSM
type State = 'idle' | 'loading' | 'success' | 'error';
state = $state<State>('idle');
uiView = $derived(UI_STATE_STRATEGY[this.state]);
```

---

#### 🟠 High: api/client.ts (180 LOC)

**Issues:**
- Retry logic hardcoded (magic numbers: 2, 150, 10000)
- Path validation (string comparisons repeated)
- Header building mixed with auth policy
- Error mapping coupled to HTTP status

**Duplication:**
```typescript
// Duplicated in: client.ts, login/login.controller.svelte.ts
function generateCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
```

---

#### 🟡 Medium: Store Fragmentation

**Current:**
- `authStore` (login + logout only)
- `tenantStore` (separate state)
- `uiStore` (skeleton only)

**Problem:** No orchestration layer. Stores are updated individually without business logic coordination.

---

### 2. Abstraction Gaps

| Layer | Current | Missing |
|-------|---------|---------|
| **UI Components** | ✓ Exists | Need atomic components library |
| **Page/Route Logic** | △ Partial | Login route has controller orchestrator; extend to contacts/settings routes |
| **Domain Services** | ✗ None | **Need:** Auth service, Contact service |
| **Query/Command** | ✗ None | **Need:** Command objects, Query builders |
| **Error Mapping** | Inline | **Need:** Centralized error context |
| **Auth Lifecycle** | Ad-hoc | **Need:** Auth orchestrator with refresh |
| **Form Handling** | Inline | **Need:** Form composable |
| **Infrastructure** | ✓ Basic | **Need:** Configurable HTTP client |

---

### 3. Duplication Analysis

| Pattern | Locations | LOC | Solution |
|---------|-----------|-----|----------|
| Correlation ID generation | 2 | 6 | `Crypto` utility service |
| Error type guards | 3 | 9 | `ErrorMapper` service |
| Field validation | 1 | 15 | `FormValidator` composable |
| Retry hardcoding | 1 | 20 | `RetryPolicy` config object |
| Token persistence | 1 | 0 | Add `SessionStore` |
| Error -> user message | 2 | 8 | `ErrorPresenter` utility |

**Total Duplication Impact:** ~60 LOC to eliminate = 33% code reduction

---

## Target Architecture

### Layer 1: Infrastructure Layer

**Purpose:** Low-level HTTP, storage, crypto utilities

**Files:**
```
src/lib/infrastructure/
├── http/
│   ├── client.ts              # Raw fetch wrapper
│   ├── interceptors.ts        # Request/response middleware
│   ├── retry-policy.ts        # Configurable retry strategy
│   └── __tests__/
├── crypto/
│   ├── id-generator.ts        # UUID + correlation IDs
│   └── __tests__/
├── storage/
│   ├── session.ts             # In-memory + optional persistence
│   └── __tests__/
└── config/
    └── http-config.ts         # Centralized HTTP constants
```

**Key Files:**

**http-config.ts** (Replace magic numbers)
```typescript
export const HTTP_CONFIG = {
  baseUrl: '/api',
  timeout: 10_000,
  retry: {
    maxAttempts: 2,
    backoffMs: 150,
    retryableStatuses: [502, 503, 504],
  },
  headers: {
    contentType: 'application/json',
    tenantIdHeader: 'X-Tenant-ID',
    authHeader: 'Authorization',
    correlationIdHeader: 'X-Correlation-ID',
  },
};
```

**crypto/id-generator.ts** (Single source of truth)
```typescript
export const IdGenerator = {
  correlationId: (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  },
};
```

---

### Layer 2: Domain Services Layer

**Purpose:** Business logic isolated from framework

**Files:**
```
src/lib/services/
├── auth/
│   ├── auth.service.ts        # Login, refresh, logout orchestration
│   ├── auth.types.ts          # AuthTokens, LoginRequest
│   ├── session.ts             # Token persistence + lifecycle
│   └── __tests__/
├── contacts/
│   ├── contacts.service.ts    # CRUD operations + queries
│   ├── contacts.types.ts      # ContactResponse, PagedResponse
│   └── __tests__/
├── error/
│   ├── error-mapper.ts        # Centralized error transformation
│   ├── error-presenter.ts     # Error -> UI message mapping
│   ├── error.types.ts         # AppError, RequestError
│   └── __tests__/
└── validation/
    ├── validators.ts          # Reusable validators
    └── __tests__/
```

**Key Files:**

**auth/auth.service.ts** (Business logic)
```typescript
export interface AuthService {
  handle(intent: LoginQuery | RefreshTokenQuery | LogoutCommand): Promise<AuthTokens | void>;
  login(tenantId: string, username: string, password: string): Promise<AuthTokens>;
  refresh(tenantId: string, refreshToken: string): Promise<AuthTokens>;
  logout(tenantId: string, refreshToken: string): Promise<void>;
  isTokenExpired(expiresAt: string): boolean;
  getAuthHeader(token: string): Record<string, string>;
}

export function createAuthService(
  httpClient: HttpClient,
  sessionStore: SessionStore
): AuthService {
  return {
    async handle(intent) {
      if (intent instanceof LoginQuery) {
        return this.login(intent.tenantId, intent.credentials.username, intent.credentials.password);
      }

      if (intent instanceof RefreshTokenQuery) {
        return this.refresh(intent.tenantId, intent.refreshToken);
      }

      if (intent instanceof LogoutCommand) {
        return this.logout(intent.tenantId, intent.refreshToken);
      }

      throw new Error('Unsupported auth intent.');
    },
    async login(tenantId, username, password) {
      const tokens = await httpClient.post<AuthTokens>('/auth/login', {
        tenantId,
        body: { username, password },
      });
      sessionStore.setTokens(tokens);
      return tokens;
    },
    // ... other methods
  };
}
```

**error/error-mapper.ts** (Centralized error transformation)
```typescript
export const ErrorMapper = {
  fromResponse(status: number, body: unknown, correlationId?: string): AppError {
    // Single source of truth for error transformation
    // Replaces inline mapping in client.ts
  },
  
  toUserMessage(error: AppError): string {
    // Error -> UI text mapping
  },
  
  isRetryable(error: AppError): boolean {
    // Error handling strategy
  },
};
```

---

### Layer 3: Query/Command Layer

**Purpose:** Intent objects instead of imperative function calls

**Files:**
```
src/lib/queries/
├── auth/
│   ├── login.query.ts         # { tenantId, username, password }
│   ├── refresh.query.ts
│   └── __tests__/
├── contacts/
│   ├── list-contacts.query.ts # { page, pageSize, filters }
│   ├── get-contact.query.ts
│   └── __tests__/
└── __tests__/

src/lib/commands/
├── auth/
│   ├── login.command.ts
│   ├── logout.command.ts
│   └── __tests__/
├── contacts/
│   ├── create-contact.command.ts
│   ├── update-contact.command.ts
│   └── __tests__/
└── __tests__/
```

**Key Pattern:**

```typescript
// Before: Scattered API calls
const tokens = await login(tenantId, { username, password }, correlationId);

// After: Intent-based queries
const loginQuery = new LoginQuery({
  tenantId,
  credentials: { username, password },
});
const tokens = await authService.handle(loginQuery);
```

---

### Layer 4: Store/State Layer

**Purpose:** Unified state management with clear actions

**Files:**
```
src/lib/stores/
├── auth/
│   ├── auth.store.ts          # Refactored with service injection
│   ├── session.store.ts       # Token lifecycle
│   └── __tests__/
├── tenant/
│   ├── tenant.store.ts
│   └── __tests__/
├── ui/
│   ├── ui.store.ts            # Notifications, modals
│   └── __tests__/
└── root.ts                    # Root store for composition
```

**Key Refactor:**

```typescript
// Before: Direct store mutation
authStore.completeLogin(tokens);

// After: Service-coordinated state
export interface AuthStore {
  state: Readable<AuthState>;
  actions: {
    login(tenantId: string, credentials: LoginRequest): Promise<void>;
    logout(): Promise<void>;
    refresh(): Promise<void>;
  };
}

// Internally coordinates service + error handling + persistence
```

---

### Layer 5: Component/UI Layer

**Purpose:** Thin presentation layer only

**Refactored Structure:**
```
src/lib/components/
├── forms/
│   ├── LoginForm.svelte       # 100 LOC (down from 250 in page)
│   ├── ContactForm.svelte
│   └── __tests__/
├── common/
│   ├── Button.svelte
│   ├── Input.svelte
│   ├── Alert.svelte
│   ├── Field.svelte           # Label + Input + Error
│   └── __tests__/
├── layout/
│   ├── AuthLayout.svelte
│   ├── DashboardLayout.svelte
│   └── __tests__/
└── features/
    ├── ContactList.svelte
    ├── ContactDetail.svelte
    └── __tests__/

src/routes/
├── login/
│   ├── +page.svelte           # 50 LOC (down from 380)
│   ├── +page.server.ts        # Optional: server-side auth
│   └── __tests__/
├── dashboard/
│   ├── contacts/
│   │   ├── +page.svelte
│   │   └── [id]/+page.svelte
│   └── __tests__/
```

---

## Layer Refactoring Plan

### Phase 1: Infrastructure (Week 1)

**Goal:** Create foundation layers with zero breaking changes

#### Task 1.1: Create HTTP Config
- [ ] `src/lib/infrastructure/config/http-config.ts`
- [ ] Export all magic numbers as constants
- [ ] Create `RetryPolicy` type
- [ ] Tests: Verify defaults are sensible

#### Task 1.2: Extract Crypto Utilities
- [ ] `src/lib/infrastructure/crypto/id-generator.ts`
- [ ] Implement `IdGenerator.correlationId()`
- [ ] Add `IdGenerator.uuid()` variant
- [ ] Tests: Mock crypto API, verify fallback

#### Task 1.3: Create HTTP Client Wrapper
- [ ] `src/lib/infrastructure/http/client.ts` (refactored)
- [ ] Remove path validation → move to service layer
- [ ] Accept config object instead of magic numbers
- [ ] Return raw response + parsed body tuple
- [ ] Tests: Keep existing tests, add config override tests

#### Task 1.4: Session Storage Service
- [ ] `src/lib/infrastructure/storage/session.ts`
- [ ] In-memory token storage
- [ ] Prepare interface for persistence (not implemented yet)
- [ ] Tests: CRUD operations on token state

**Success Criteria:**
- ✅ All existing tests pass
- ✅ No imports from old locations (gradual cutover)
- ✅ Config is centralizable (easy to inject test values)

---

### Phase 2: Domain Services (Week 2)

**Goal:** Extract business logic from components and API wrappers

#### Task 2.1: Create Error Mapper Service
- [ ] `src/lib/services/error/error-mapper.ts`
- [ ] Move logic from `errors.ts` + `client.ts`
- [ ] Single `mapApiError(status, body, correlationId)` function
- [ ] Tests: All status codes, various response bodies

#### Task 2.2: Create Auth Service
- [ ] `src/lib/services/auth/auth.service.ts`
- [ ] Orchestrate `login()`, `refresh()`, `logout()`
- [ ] Inject `httpClient` + `sessionStore`
- [ ] Return typed `AuthTokens` from each method
- [ ] Tests: Mock httpClient, verify token storage

#### Task 2.3: Create Contacts Service
- [ ] `src/lib/services/contacts/contacts.service.ts`
- [ ] Wrap `listContacts()`, `getContact()`, `createContact()`, etc.
- [ ] Add pagination abstraction (query object instead of individual params)
- [ ] Tests: Mock httpClient, verify API paths

#### Task 2.4: Create Validation Service
- [ ] `src/lib/services/validation/validators.ts`
- [ ] Extract field validators: `isNonEmpty()`, `isValidEmail()`, etc.
- [ ] Create `FormValidator` class for login form validation
- [ ] Tests: Valid + invalid inputs for each validator

**Success Criteria:**
- ✅ Services are framework-agnostic (testable in isolation)
- ✅ No circular dependencies
- ✅ Services only accept interfaces, not concrete implementations

---

### Phase 3: Store Refactoring (Week 3)

**Goal:** Stores now delegate to services

#### Task 3.1: Refactor Auth Store
- [ ] Inject `AuthService` into store creator
- [ ] Move `login()` logic: store only manages state
- [ ] `startLogin()` → `await authService.login()` → `completeLogin()`
- [ ] Handle errors centrally in error handler
- [ ] Tests: Mock service, verify state transitions

#### Task 3.2: Refactor Tenant Store
- [ ] Keep simple (no service needed)
- [ ] Add `setError()` handler
- [ ] Tests: Basic state mutations

#### Task 3.3: Create Session Store
- [ ] `src/lib/stores/session.store.ts` (new)
- [ ] Manage token lifecycle + expiration checks
- [ ] Trigger refresh before expiry
- [ ] Tests: Token refresh logic

**Success Criteria:**
- ✅ Stores are thin (< 50 LOC each)
- ✅ No business logic in stores
- ✅ Error handling is centralized

---

### Phase 4: Component Decomposition (Week 4)

**Goal:** Break login/+page.svelte into small, reusable components

#### Task 4.1: Create Atomic Components
- [ ] `Button.svelte` (50 LOC)
- [ ] `Input.svelte` (40 LOC)
- [ ] `Alert.svelte` (30 LOC)
- [ ] `Field.svelte` (60 LOC, wraps Input + Label + Error)
- [ ] Tests: Props, slots, event forwarding

#### Task 4.2: Create LoginForm Component
- [ ] `src/lib/components/forms/LoginForm.svelte` (100 LOC)
- [ ] Props: `loading`, `error`, `onSubmit`, `onFieldChange`
- [ ] Emit: `submit` event with form data
- [ ] Manage: Field errors only (no app state)
- [ ] Tests: Form submission, validation errors, field updates

#### Task 4.3: Refactor Login Page
- [ ] `src/routes/login/+page.svelte` (50 LOC, down from 380)
- [ ] Import `LoginForm` component
- [ ] Delegate to `authStore` for login logic
- [ ] Handle navigation + error display
- [ ] Tests: Keep existing tests, add form integration tests

#### Task 4.4: Create Contact Components
- [ ] `ContactList.svelte` (120 LOC)
- [ ] `ContactDetail.svelte` (100 LOC)
- [ ] `ContactForm.svelte` (120 LOC)
- [ ] Tests: Props, data loading, events

**Success Criteria:**
- ✅ login/+page.svelte < 60 LOC
- ✅ All components < 150 LOC
- ✅ Components accept data + emit events (no side effects)
- ✅ Existing tests still pass

---

### Phase 5: Query/Command Layer (Week 5)

**Goal:** Add intent-based abstraction (optional but recommended)

#### Task 5.1: Create Query Objects
- [ ] `src/lib/queries/auth/login.query.ts`
- [ ] `src/lib/queries/contacts/list-contacts.query.ts`
- [ ] Simple data classes with validation

#### Task 5.2: Create Query Handler
- [ ] `src/lib/queries/query-handler.ts`
- [ ] Route queries to appropriate service
- [ ] Centralized error handling

#### Task 5.3: Update Store Actions
- [ ] Change from: `authService.login(tenantId, username, password)`
- [ ] Change to: `authService.handle(new LoginQuery({...}))`
- [ ] Optional: Add query caching layer

**Success Criteria:**
- ✅ Business intent is explicit in queries
- ✅ Service layer is decoupled from store layer
- ✅ Queries are testable in isolation

---

## Component Decomposition

### Before: Monolithic Login Page (380 LOC)

```svelte
<script lang="ts">
  // 8+ local state variables
  let tenantId = '';
  let username = '';
  let password = '';
  // ... validation, errors, correlation IDs
  
  // Inline validation
  function validateForm() { ... }
  
  // Inline correlation ID generation
  function createCorrelationId() { ... }
  
  // Inline error mapping
  async function handleSubmit() {
    try {
      const tokens = await login(...);
      authStore.completeLogin(tokens);
    } catch (error) {
      // Error mapping inline
    }
  }
</script>

<!-- 200+ lines of template with styles -->
```

### After: Composed Structure

```svelte
<!-- login/+page.svelte: 50 LOC -->
<script lang="ts">
  import { authStore } from '$lib/stores/auth.store';
  import { tenantStore } from '$lib/stores/tenant.store';
  import LoginForm from '$lib/components/forms/LoginForm.svelte';
  import LoginHero from '$lib/components/features/LoginHero.svelte';
  
  let isLoading = false;
  let error: AppError | null = null;
  
  async function handleLogin(event: CustomEvent<LoginFormData>) {
    isLoading = true;
    error = null;
    
    try {
      await authStore.actions.login(
        event.detail.tenantId,
        event.detail.credentials
      );
      await goto('/dashboard');
    } catch (e) {
      error = e instanceof RequestError ? e.appError : null;
    } finally {
      isLoading = false;
    }
  }
</script>

<main class="login-shell">
  <LoginHero />
  <LoginForm 
    {isLoading} 
    {error}
    on:submit={handleLogin}
  />
</main>
```

```svelte
<!-- LoginForm.svelte: 100 LOC -->
<script lang="ts">
  import Field from '$lib/components/common/Field.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import Alert from '$lib/components/common/Alert.svelte';
  import { createFormValidator } from '$lib/composables/form-validator';
  
  export let isLoading = false;
  export let error: AppError | null = null;
  
  const form = createFormValidator({
    tenantId: ['required'],
    username: ['required'],
    password: ['required'],
  });
  
  function handleSubmit() {
    if (!form.validate()) return;
    
    dispatch('submit', {
      tenantId: form.data.tenantId,
      credentials: {
        username: form.data.username,
        password: form.data.password,
      },
    });
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  {#if error}
    <Alert type="error" {error} />
  {/if}
  
  <Field label="Tenant ID">
    <input bind:value={form.data.tenantId} />
    {#if form.errors.tenantId}
      <p class="error">{form.errors.tenantId}</p>
    {/if}
  </Field>
  
  <!-- More fields -->
  
  <Button type="submit" disabled={isLoading}>
    {isLoading ? 'Signing in...' : 'Sign in'}
  </Button>
</form>
```

---

## Implementation Roadmap

### Weekly Timeline

| Week | Phase | Key Deliverables | Tests | Status |
|------|-------|------------------|-------|--------|
| **1** | Infrastructure | HTTP config, ID generator, session storage | +6 | Sprint 1 |
| **2** | Domain Services | Error mapper, auth service, contacts service | +12 | Sprint 1 |
| **3** | Stores | Auth store refactor, session store, error handler | +8 | Sprint 2 |
| **4** | Components | Atomic components, LoginForm, login page | +10 | Sprint 2 |
| **5** | Query/Command | Query objects, handlers, final integration | +6 | Sprint 3 |

### Git Strategy

```bash
# Parallel branches for each phase
git checkout -b phase/infrastructure
git checkout -b phase/domain-services
git checkout -b phase/stores
git checkout -b phase/components

# Integrate branches back into master with CI green (PRs preferred)
git checkout master
git merge --no-ff phase/infrastructure
git merge --no-ff phase/domain-services
git merge --no-ff phase/stores
git merge --no-ff phase/components

# Keep master green at all times
```

### Rollback Plan

- ✅ Each phase is independently reversible
- ✅ New infrastructure doesn't break old patterns
- ✅ Old API routes stay available during transition
- ✅ Feature flags: `useNewAuthService = false` during development

---

## Testing Strategy

### Test Pyramid

```
                 /\
               /    \      E2E Tests (10%)
              /      \     - Login flow
            /________\    - Contact CRUD
           /          \   - Error scenarios
         /            \   
       /______      __\   Integration (20%)
      /      \    /    \  - Store + Service
    /        \  /      \ - Service + HTTP Client
  /________\/__________\ Unit Tests (70%)
                        - Validators
                        - Error mapper
                        - Services
                        - Utilities
```

### Unit Test Coverage

#### Infrastructure Layer

```typescript
// http-config.ts
describe('HTTP_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(HTTP_CONFIG.timeout).toBe(10_000);
    expect(HTTP_CONFIG.retry.maxAttempts).toBeGreaterThan(0);
  });
});

// id-generator.ts
describe('IdGenerator', () => {
  it('generates valid UUIDs', () => {
    const id = IdGenerator.correlationId();
    expect(id).toMatch(/^[a-f0-9-]+$/i);
  });
  
  it('falls back when crypto API unavailable', () => {
    // Mock missing crypto API
    // Verify fallback format
  });
});
```

#### Domain Services Layer

```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let httpClient: MockHttpClient;
  let sessionStore: MockSessionStore;
  
  beforeEach(() => {
    httpClient = createMockHttpClient();
    sessionStore = createMockSessionStore();
    authService = createAuthService(httpClient, sessionStore);
  });
  
  describe('login', () => {
    it('calls POST /auth/login with credentials', async () => {
      httpClient.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date().toISOString(),
      });
      
      await authService.login('tenant-a', 'user', 'pass');
      
      expect(httpClient.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          tenantId: 'tenant-a',
          body: { username: 'user', password: 'pass' },
        })
      );
    });
    
    it('stores tokens in session', async () => {
      const tokens = { accessToken: 'token', ... };
      httpClient.post.mockResolvedValue(tokens);
      
      await authService.login('tenant-a', 'user', 'pass');
      
      expect(sessionStore.setTokens).toHaveBeenCalledWith(tokens);
    });
    
    it('throws RequestError on API failure', async () => {
      httpClient.post.mockRejectedValue(
        new RequestError(...)
      );
      
      await expect(
        authService.login('tenant-a', 'user', 'pass')
      ).rejects.toBeInstanceOf(RequestError);
    });
  });
});
```

#### Component Layer

```typescript
describe('LoginForm.svelte', () => {
  it('submits form data on valid input', async () => {
    const { component, getByRole } = render(LoginForm);
    const submitEvent = vi.fn();
    
    component.$on('submit', submitEvent);
    
    await userEvent.type(
      screen.getByLabelText('Tenant ID'),
      'tenant-a'
    );
    await userEvent.type(
      screen.getByLabelText('Username'),
      'alice'
    );
    await userEvent.type(
      screen.getByLabelText('Password'),
      'password'
    );
    
    await userEvent.click(getByRole('button', { name: 'Sign in' }));
    
    expect(submitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          tenantId: 'tenant-a',
          credentials: { username: 'alice', password: 'password' },
        },
      })
    );
  });
  
  it('displays error from props', () => {
    const error = {
      kind: 'auth',
      message: 'Invalid credentials',
      details: [],
      code: 'unauthorized',
    };
    
    render(LoginForm, { props: { error } });
    
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid credentials'
    );
  });
});
```

### Integration Test Coverage

```typescript
describe('Auth Flow (Store + Service + HTTP)', () => {
  let authStore: AuthStore;
  let httpClient: MockHttpClient;
  let sessionStore: SessionStore;
  
  beforeEach(() => {
    httpClient = createMockHttpClient();
    sessionStore = new SessionStore();
    const authService = createAuthService(httpClient, sessionStore);
    authStore = createAuthStore(authService);
  });
  
  it('completes login flow end-to-end', async () => {
    httpClient.post.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: new Date().toISOString(),
    });
    
    await authStore.actions.login('tenant-a', {
      username: 'alice',
      password: 'password',
    });
    
    const state = get(authStore.state);
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('token');
  });
});
```

### E2E Test Coverage (Playwright)

```typescript
// tests/login.e2e.ts
test('user can login with valid credentials', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[data-testid=tenant-id]', 'tenant-a');
  await page.fill('[data-testid=username]', 'alice');
  await page.fill('[data-testid=password]', 'password');
  
  await page.click('button:has-text("Sign in")');
  
  await page.waitForURL('/dashboard');
  expect(await page.locator('h1')).toContainText('Dashboard');
});

test('user sees error message on failed login', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[data-testid=tenant-id]', 'tenant-a');
  await page.fill('[data-testid=username]', 'alice');
  await page.fill('[data-testid=password]', 'wrong-password');
  
  await page.click('button:has-text("Sign in")');
  
  await page.waitForSelector('[role="alert"]');
  expect(await page.locator('[role="alert"]')).toContainText(
    'Invalid credentials'
  );
});
```

---

## Code Quality Metrics

### Before Refactor

```
Lines of Code (LOC):
  - login/+page.svelte: 380 LOC
  - api/client.ts: 180 LOC
  - Total: ~1,200 LOC (all files)

Cyclomatic Complexity:
  - login page: 15+ (hard to understand)
  - client.ts: 8+ (retry logic)
  - Average: 6.2

Test Coverage:
  - Statements: 72%
  - Branches: 58%
  - Functions: 68%
  - Lines: 71%

Duplication (DRY):
  - Correlation ID: 2x
  - Error mapping: 3x
  - Field validation: 1x (but inline)
  - Retry logic: 1x (but hardcoded)
```

### After Refactor (Target)

```
Lines of Code (LOC):
  - login/+page.svelte: 50 LOC (-87%)
  - api/client.ts: 100 LOC (-44%)
  - Total: ~800 LOC (-33%)

Cyclomatic Complexity:
  - login page: 2 (simple)
  - services: 3-4 each (clear logic)
  - Average: 2.1

Test Coverage:
  - Statements: 92%
  - Branches: 88%
  - Functions: 95%
  - Lines: 90%

Duplication (DRY):
  - Correlation ID: 1x (centralized)
  - Error mapping: 1x (centralized)
  - Field validation: 1x (composable)
  - Retry logic: 1x (configurable)
```

---

## File Structure: Before & After

### Before

```
src/lib/
├── api/
│   ├── auth.ts          (45 LOC) ← thin wrapper
│   ├── client.ts        (180 LOC) ← monolithic
│   ├── contacts.ts      (60 LOC) ← duplicated logic
│   ├── errors.ts        (90 LOC) ← scattered mapping
│   └── __tests__/
├── stores/
│   ├── auth.store.ts    (45 LOC) ← no service layer
│   ├── tenant.store.ts  (30 LOC)
│   └── ui.store.ts      (10 LOC)
├── utils/
│   ├── validation.ts    (5 LOC) ← incomplete
│   ├── telemetry.ts
│   └── a11y.ts
└── components/          ← mostly stubs

src/routes/
└── login/
    ├── +page.svelte     (380 LOC) ← monolithic
    └── __tests__/
```

### After

```
src/lib/
├── infrastructure/
│   ├── config/
│   │   └── http-config.ts
│   ├── http/
│   │   ├── client.ts           (100 LOC, refactored)
│   │   ├── interceptors.ts     (new)
│   │   └── retry-policy.ts     (new, 30 LOC)
│   ├── crypto/
│   │   └── id-generator.ts     (new, 15 LOC)
│   ├── storage/
│   │   └── session.ts          (new, 40 LOC)
│   └── __tests__/
├── services/
│   ├── auth/
│   │   ├── auth.service.ts     (new, 80 LOC)
│   │   ├── session.ts          (new, 40 LOC)
│   │   └── __tests__/
│   ├── contacts/
│   │   ├── contacts.service.ts (new, 70 LOC)
│   │   └── __tests__/
│   ├── error/
│   │   ├── error-mapper.ts     (new, 60 LOC)
│   │   ├── error-presenter.ts  (new, 30 LOC)
│   │   └── __tests__/
│   ├── validation/
│   │   ├── validators.ts       (new, 50 LOC)
│   │   └── __tests__/
│   └── __tests__/
├── queries/
│   ├── auth/
│   │   ├── login.query.ts      (new, 20 LOC)
│   │   └── __tests__/
│   ├── contacts/
│   │   ├── list-contacts.query.ts (new, 25 LOC)
│   │   └── __tests__/
│   └── query-handler.ts        (new, 40 LOC)
├── commands/
│   ├── auth/
│   │   ├── login.command.ts    (new, 20 LOC)
│   │   └── __tests__/
│   └── __tests__/
├── stores/
│   ├── auth/
│   │   ├── auth.store.ts       (40 LOC, refactored)
│   │   └── __tests__/
│   ├── session/
│   │   └── session.store.ts    (new, 35 LOC)
│   ├── tenant/
│   │   └── tenant.store.ts     (30 LOC, refactored)
│   ├── ui/
│   │   └── ui.store.ts         (refactored)
│   └── __tests__/
├── components/
│   ├── atomic/
│   │   ├── Button.svelte
│   │   ├── Input.svelte
│   │   ├── Field.svelte
│   │   ├── Alert.svelte
│   │   └── __tests__/
│   ├── forms/
│   │   ├── LoginForm.svelte    (new, 100 LOC)
│   │   ├── ContactForm.svelte  (new, 120 LOC)
│   │   └── __tests__/
│   ├── features/
│   │   ├── ContactList.svelte  (new, 120 LOC)
│   │   ├── LoginHero.svelte    (extracted, 100 LOC)
│   │   └── __tests__/
│   ├── layout/
│   │   ├── AuthLayout.svelte
│   │   └── DashboardLayout.svelte
│   └── __tests__/
├── composables/
│   ├── form-validator.ts       (new, 80 LOC)
│   ├── use-fetch.ts            (new, 60 LOC)
│   └── __tests__/
└── utils/
    ├── validation.ts           (refactored)
    ├── telemetry.ts
    └── a11y.ts

src/routes/
├── login/
│   ├── +page.svelte            (50 LOC, refactored)
│   ├── +page.server.ts         (optional)
│   └── __tests__/
├── dashboard/
│   ├── +layout.svelte          (refactored)
│   ├── +page.svelte
│   ├── contacts/
│   │   ├── +page.svelte
│   │   └── [id]/
│   │       ├── +page.svelte
│   │       └── edit/
│   │           └── +page.svelte
│   └── __tests__/
└── __tests__/
```

---

## Success Metrics

### Code Metrics

- ✅ **Max component LOC:** 50-150 (current: 380)
- ✅ **Cyclomatic complexity:** < 5 per function (current: 15+)
- ✅ **Duplication ratio:** < 3% (current: ~15%)
- ✅ **Test coverage:** > 90% (current: 72%)

### Maintainability Metrics

- ✅ **Time to add new feature:** < 2 hours (current: 4+)
- ✅ **Time to fix bug:** < 30 min (current: 1+ hour)
- ✅ **Onboarding time:** 1-2 days (current: 3+ days)
- ✅ **Abstraction layers:** 5 (current: 2)

### Developer Experience

- ✅ **IDE code completion:** Works in all layers
- ✅ **Test isolation:** Services testable without components
- ✅ **Error messages:** Clear and actionable
- ✅ **Debugging:** Stack traces point to actual issue

---

## Implementation Checklist

### Phase 1 Checklist (Infrastructure)
- [ ] Create `http-config.ts`
- [ ] Extract `id-generator.ts`
- [ ] Refactor `client.ts` to use config
- [ ] Create `session-storage.ts`
- [ ] Add Phase 1 tests (target: +6)
- [ ] Update `vitest.setup.ts` if needed
- [ ] Verify no breaking changes

### Phase 2 Checklist (Services)
- [ ] Create `error-mapper.ts`
- [ ] Create `error-presenter.ts`
- [ ] Create `auth.service.ts`
- [ ] Create `contacts.service.ts`
- [ ] Create `validators.ts`
- [ ] Add Phase 2 tests (target: +12)
- [ ] Remove duplicate error logic from `errors.ts`

### Phase 3 Checklist (Stores)
- [ ] Refactor `auth.store.ts` with service injection
- [ ] Create `session.store.ts`
- [ ] Update `tenant.store.ts` error handling
- [ ] Add Phase 3 tests (target: +8)
- [ ] Verify login/logout still works

### Phase 4 Checklist (Components)
- [ ] Create atomic components (Button, Input, Field, Alert)
- [ ] Create `LoginForm.svelte`
- [x] Refactor `login/+page.svelte` to pure view + `login.controller.svelte.ts` headless controller
- [ ] Create `ContactList.svelte`, `ContactDetail.svelte`
- [ ] Extract `LoginHero.svelte`
- [ ] Add Phase 4 tests (target: +10)
- [ ] Verify styling/animations still work

### Phase 5 Checklist (Query/Command)
- [ ] Create query objects (optional but recommended)
- [ ] Create query handler
- [ ] Update service methods to accept queries
- [ ] Add Phase 5 tests (target: +6)
- [ ] Verify E2E flows still work

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Breaking changes mid-refactor | Medium | High | Feature flags + parallel branches |
| Test coverage drop | Low | High | Enforce > 90% target from start |
| Performance regression | Low | Medium | Benchmark HTTP + render times |
| Team confusion on new patterns | Medium | Medium | Documentation + pair programming |
| Timeline overrun | Medium | Medium | Strict phase gates, prioritize MVP |

---

## FAQ & Decisions

### Q: Should we use TypeScript strict mode?
**A:** Yes. Already enabled in `tsconfig.json`. Refactor should improve type safety.

### Q: Do we need a state machine for auth?
**A:** Yes for UI auth state management. The login route already uses an FSM (`idle | loading | success | error`) as described in the Executive Summary and implemented in `login.controller.svelte.ts`. Keep stores for persisted app data, but use explicit FSM transitions for async auth UI flows.

### Q: Should components use stores directly or services?
**A:** Routes/pages use stores. Components use props + events. Stores delegate to services.

### Q: How do we handle async operations in stores?
**A:** Stores call service methods, which return Promises. Use `async/await` in route handlers.

### Q: Do we add composition API or keep Svelte 5 Runes?
**A:** Stick with Runes. They're simpler for this codebase.

### Q: When do we migrate to new patterns?
**A:** Gradually. Old patterns still work. New code uses new patterns. No big-bang migration.

---

## Conclusion

This refactor transforms your codebase from **monolithic + scattered** to **modular + composed**.

**Key Principles:**
1. One responsibility per file
2. Services are framework-agnostic
3. Components are dumb presenters
4. Stores are thin state managers
5. Tests are first-class citizens

**Expected Outcome:**
- 33% less code (1200 → 800 LOC)
- 10x fewer duplication issues
- 3x faster bug fixes
- 2x easier onboarding

Start with Phase 1. Deploy incrementally. Keep master green.

**Ready? Let's ship it.** 🚀
