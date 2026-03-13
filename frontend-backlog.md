# Effinsty Frontend Implementation Backlog

**Source spec:** `frontend.md` v1.1  
**Backlog date:** 2026-03-12  
**Derived from backend code:** `src/Effinsty.Api`, `src/Effinsty.Application`, `src/Effinsty.Domain`, `src/Effinsty.Infrastructure`

---

## 1) Backend Comparison Summary (Spec vs Reality)

### Confirmed and aligned
- Tenant enforcement exists globally (except health endpoints) via `X-Tenant-ID` middleware.
- Correlation ID is accepted/generated and echoed in `X-Correlation-ID` response header.
- Contacts CRUD endpoints and paging (`page`, `pageSize`, max 100) are implemented.
- Uniform API error response shape is implemented: `code`, `message`, `details`, `correlationId`.

### Gaps and mismatches to resolve
1. Refresh/logout contract mismatch with v1.1 spec:
   - Backend currently requires JSON body `{ refreshToken }` for both `/api/auth/refresh` and `/api/auth/logout`.
   - `/api/auth/logout` also requires bearer auth.
   - v1.1 spec assumed cookie-driven refresh flow.
2. Scope enforcement update:
   - Backend routing enforces `contacts.read` / `contacts.write` / `contacts.delete` scopes.
   - Frontend v1.1 still should not gate UI behavior on scope claims.
3. Search/sort mismatch:
   - v1.1 UX baseline includes search/sort.
   - Backend contacts list supports paging only (no search/sort query contract yet).
4. Token model mismatch risk:
   - Backend login/refresh responses include both `accessToken` and `refreshToken`.
   - v1.1 frontend security model prefers HttpOnly cookie refresh tokens.

### Decision outcomes (locked for FE-00)
- DG-1: Keep refresh token in JSON body for v1.1 frontend (`{ refreshToken }` for refresh/logout; logout also requires bearer auth).
- DG-2: Backend scope enforcement is implemented; keep frontend v1.1 UI behavior independent from scope-claim gating.
- DG-3: Defer backend search/sort API; ship paging-only contract and allow only client-side search/sort within the current page with explicit UI labeling.

---

## 2) Epic Backlog

## EPIC FE-00: API Contract Lock and Alignment

### Story FE-00.1: Freeze v1 frontend API contract to current backend
**Acceptance criteria**
- Frontend contract doc reflects exact current payloads/headers.
- Team explicitly records DG-1, DG-2, DG-3 outcomes.

**Contract snapshot (backend-aligned, exact JSON keys)**

| Endpoint | Request body | Response body |
|---|---|---|
| `POST /api/auth/login` | `{ "username": "string", "password": "string" }` | `{ "accessToken": "string", "refreshToken": "string", "expiresAt": "ISO-8601" }` |
| `POST /api/auth/refresh` | `{ "refreshToken": "string" }` | `{ "accessToken": "string", "refreshToken": "string", "expiresAt": "ISO-8601" }` |
| `POST /api/auth/logout` | `{ "refreshToken": "string" }` | `{ "success": true }` |
| `GET /api/contacts` | query: `page`, `pageSize` | `{ "items": ContactResponse[], "page": number, "pageSize": number, "totalCount": number }` |

`ContactResponse` contract:
- `id`, `firstName`, `lastName`, `email`, `phone`, `address`, `metadata`, `createdAt`, `updatedAt`

`ErrorResponse` contract:
- `code`, `message`, `details`, `correlationId`

Headers by endpoint:

| Endpoint group | `Authorization` | `X-Tenant-ID` | `X-Correlation-ID` |
|---|---|---|---|
| `/api/health*` | Not required | Not required | Optional |
| `/api/auth/login` | Not required | Required | Optional (echoed in response) |
| `/api/auth/refresh` | Not required | Required | Optional (echoed in response) |
| `/api/auth/logout` | Required | Required | Optional (echoed in response) |
| `/api/contacts*` | Required | Required | Optional (echoed in response) |

Paging limits:
- `pageSize` is capped at `100` (values above 100 are clamped to 100).

**Tasks**
- [x] FE-00.1.a Add contract table for auth/contact/error payloads with exact fields/casing.
- [x] FE-00.1.b Document required headers by endpoint (`Authorization`, `X-Tenant-ID`, optional `X-Correlation-ID`).
- [x] FE-00.1.c Document `/api/auth/logout` auth requirement and refresh body requirement.
- [x] FE-00.1.d Record paging limits (`pageSize` capped at 100).

### Story FE-00.2: Add contract tests (backend-side in FE-00; mirror frontend-side in FE-01)
**Acceptance criteria**
- Contract tests fail on response shape drift and required header regressions.

**Tasks**
- [x] FE-00.2.a Add backend-side contract tests for `LoginResponse`, `PagedResponse<ContactResponse>`, `ErrorResponse` JSON shape/casing.
- [x] FE-00.2.b Add backend-side contract test asserting error payload keys include `correlationId`.
- [x] FE-00.2.c Add backend-side contract test asserting missing tenant context yields structured 4xx error.
- [x] FE-00.2.d Mirror FE-00.2 contract tests in frontend test suite during FE-01 bootstrap.

---

## EPIC FE-01: Frontend Foundation and Project Bootstrapping

### Story FE-01.1: Bootstrap SvelteKit frontend workspace in `/frontend`
**Acceptance criteria**
- SvelteKit app runs in `/frontend` and route skeleton matches `frontend.md` section 4.2.

**Tasks**
- [x] FE-01.1.a Initialize SvelteKit + TypeScript + Tailwind in `/frontend`.
- [x] FE-01.1.b Wire path aliases (`$lib`) and strict TS settings.
- [x] FE-01.1.c Add lint/format/typecheck/test scripts.
- [x] FE-01.1.d Add CI job for frontend checks.

### Story FE-01.2: Shared HTTP client and error mapping
**Acceptance criteria**
- One typed HTTP client used by all services.
- Errors normalized to UI-safe discriminated model.

**Tasks**
- [x] FE-01.2.a Implement `api/client.ts` with base URL, credentials policy, timeout.
- [x] FE-01.2.b Add correlation-id generation and header propagation.
- [x] FE-01.2.c Implement `api/errors.ts` mapping from API `ErrorResponse` to app error variants.
- [x] FE-01.2.d Add retry policy for idempotent reads only.

---

## EPIC FE-02: Authentication and Session Flows

### Story FE-02.1: Implement login flow against real backend contract
**Acceptance criteria**
- Login sends `{ username, password }` with tenant header.
- Stores access token in JavaScript in-memory state only (not browser `localStorage`/`sessionStorage`; state is lost on refresh).

**Tasks**
- [x] FE-02.1.a Implement `api/auth.ts` login service.
- [x] FE-02.1.b Implement `stores/auth.store.ts` with in-memory access token.
- [x] FE-02.1.c Implement login page form validation and error display.
- [x] FE-02.1.d Redirect authenticated users from `/login` to `/dashboard`.

### Story FE-02.2: Implement refresh and logout based on DG-1
**Acceptance criteria**
- Refresh and logout behavior matches selected DG-1 model.

**Tasks**
- [ ] FE-02.2.a Persist refresh token in JavaScript in-memory session state only (not browser `localStorage`/`sessionStorage`; value is lost on page refresh and requires re-authentication).
- [ ] FE-02.2.b Call `/api/auth/refresh` with `{ refreshToken }` on 401.
- [ ] FE-02.2.c Call `/api/auth/logout` with bearer token + `{ refreshToken }`.
- [ ] FE-02.2.d On refresh failure, clear state and redirect to login.

### Story FE-02.3: Route protection and tenant bootstrap
**Acceptance criteria**
- Protected routes require auth and tenant context.

**Tasks**
- [ ] FE-02.3.a Implement dashboard layout guard.
- [ ] FE-02.3.b Implement tenant resolver store and invalid-tenant UX.
- [ ] FE-02.3.c Add return-url support after login.

---

## EPIC FE-03: Contacts Domain Features

### Story FE-03.1: Contacts list with paging
**Acceptance criteria**
- Uses backend paging contract (`page`, `pageSize` <= 100).
- Renders loading, empty, and error states.

**Tasks**
- [ ] FE-03.1.a Implement `api/contacts.ts` list/get/create/update/delete.
- [ ] FE-03.1.b Build contacts list route + pagination component.
- [ ] FE-03.1.c Surface correlation id in advanced error detail view.

### Story FE-03.2: Contacts create/edit/delete
**Acceptance criteria**
- Forms validate per backend-compatible constraints.
- Delete requires confirmation.

**Tasks**
- [ ] FE-03.2.a Implement create and edit pages with shared form component.
- [ ] FE-03.2.b Add metadata key/value editor.
- [ ] FE-03.2.c Add delete action with confirm modal and toast feedback.

### Story FE-03.3: Search/sort behavior (DG-3 locked to defer backend search/sort API)
**Acceptance criteria**
- Search/sort UX is explicit and not misleading.

**Tasks**
- [ ] FE-03.3.a Implement client-side search/sort over loaded page only.
- [ ] FE-03.3.b Label behavior as "within current page" in UI.

---

## EPIC FE-04: UI System (Design, Accessibility, Motion)

### Story FE-04.1: Semantic tokens and style layers
**Acceptance criteria**
- All component colors consume semantic tokens.

**Tasks**
- [ ] FE-04.1.a Implement `styles/tokens.css`, `base.css`, `utilities.css`, `motion.css`.
- [ ] FE-04.1.b Wire Tailwind config to CSS variables/tokens.
- [ ] FE-04.1.c Add lint/check to prevent raw color literals in component classes.

### Story FE-04.2: Core component kit v1
**Acceptance criteria**
- Required common components exist with variant system.

**Tasks**
- [ ] FE-04.2.a Build `Button`, `Field/Input`, `Modal`, `Toast`, `Pagination`, `Skeleton`, `EmptyState`.
- [ ] FE-04.2.b Add keyboard focus and aria semantics to all interactive components.
- [ ] FE-04.2.c Add reduced-motion behavior to animated components.

### Story FE-04.3: Accessibility conformance
**Acceptance criteria**
- Login + contacts flows pass WCAG 2.2 AA checks and manual keyboard pass.

**Tasks**
- [ ] FE-04.3.a Add live-region utility and announce async status changes.
- [ ] FE-04.3.b Add `axe` tests for login and contacts pages.
- [ ] FE-04.3.c Run screen-reader smoke test and record outcomes.

---

## EPIC FE-05: Security, Observability, and Performance

### Story FE-05.1: Security hardening
**Acceptance criteria**
- No sensitive token persistence to browser `localStorage`/`sessionStorage` APIs; untrusted HTML blocked by policy.
- "Memory session state only" means JavaScript in-memory variables (not `sessionStorage`) and is lost on page refresh, requiring re-authentication.

**Tasks**
- [ ] FE-05.1.a Enforce no token writes to browser `localStorage`/`sessionStorage` APIs; keep tokens only in JavaScript in-memory variables.
- [ ] FE-05.1.b Add CSP documentation and integration checklist for deployment.
- [ ] FE-05.1.c Add static guard rule for forbidden raw `{@html}` usage.

### Story FE-05.2: Telemetry and diagnostics
**Acceptance criteria**
- Correlation IDs and request failures observable in client logs.

**Tasks**
- [ ] FE-05.2.a Implement telemetry util for page/action/error events.
- [ ] FE-05.2.b Log and surface API correlation IDs in error UI.
- [ ] FE-05.2.c Add health endpoint polling UI contract (`/api/health` only for frontend).

### Story FE-05.3: Performance budgets
**Acceptance criteria**
- Performance budgets measured and reported pre-release.

**Tasks**
- [ ] FE-05.3.a Add bundle size reporting in CI.
- [ ] FE-05.3.b Add lazy route loading and skeleton stabilization.
- [ ] FE-05.3.c Capture Web Vitals in staging.

---

## EPIC FE-06: Testing and Release Readiness

### Story FE-06.1: Unit/component/e2e coverage
**Acceptance criteria**
- Critical auth and contacts flows are covered by tests.

**Tasks**
- [ ] FE-06.1.a Unit tests for stores and API error mapping.
- [ ] FE-06.1.b Component tests for form validation and pagination.
- [ ] FE-06.1.c E2E tests for login, list, create, edit, delete, logout.

### Story FE-06.2: Release checklist and runbook
**Acceptance criteria**
- Team can ship with repeatable checklist and rollback steps.

**Tasks**
- [ ] FE-06.2.a Create frontend release checklist doc.
- [ ] FE-06.2.b Create incident triage notes using `correlationId`.
- [ ] FE-06.2.c Define rollback criteria and feature-flag fallback points.

---

## 3) Suggested Execution Order

1. FE-00 Contract Lock (critical blocker removal)
2. FE-01 Foundation
3. FE-02 Authentication
4. FE-03 Contacts core
5. FE-04 UI/accessibility polish in parallel with FE-03
6. FE-05 Security/observability/performance
7. FE-06 Test hardening and release

---

## 4) Immediate Sprint-1 Candidate (Concrete)

- FE-00.1.a, FE-00.1.b, FE-00.1.c
- FE-01.1.a, FE-01.1.b
- FE-01.2.a, FE-01.2.b
- FE-02.1.a, FE-02.1.b, FE-02.3.a
- FE-03.1.a (list/get only)
- FE-04.1.a (token and base style foundation)
