# Effinsty Frontend Development Specification

**Version:** 1.1  
**Date:** 2026-03-12  
**Status:** Draft for team review  
**Technology Stack:** SvelteKit 2 + Svelte 5, TypeScript, Bun, Vite, TailwindCSS

---

## 1) Purpose and Scope

This document defines the frontend architecture, UX standards, implementation rules, and delivery plan for Effinsty.

Scope for v1.1:
- Authenticated contact management UI (login, dashboard, contacts CRUD, settings)
- Multi-tenant behavior (`X-Tenant-ID` required for tenant-scoped API calls)
- Mobile-first responsive system
- WCAG 2.2 AA accessibility baseline
- Production-grade frontend security and observability

Out of scope for v1.1:
- Native mobile apps
- Offline-first sync engine (deferred)
- Advanced analytics/experimentation platform (deferred)

---

## 2) Validation Summary from v1.0

This update is based on a validation pass of the previous spec.

Key issues found in v1.0:
1. Framework mismatch: document mixed plain Vite assumptions with SvelteKit route conventions (`+page.svelte`, `$app/*`).
2. Auth contradictions: both cookie-based and body-passed refresh token patterns were specified simultaneously.
3. Implementation drift: several snippets were not compile-safe (missing imports, incorrect config examples, mixed paradigms).
4. Spec style issue: too much pseudo-code, not enough enforceable decisions and acceptance criteria.

What changed in v1.1:
- Standardized on SvelteKit-first architecture and conventions.
- Converted the doc to decision-oriented standards with measurable acceptance criteria.
- Added formal design-system, responsive, accessibility, motion, and CSS architecture policies.
- Added roadmap and open-questions section for unresolved contract decisions.

---

## 3) Product UX Goals

1. Fast first-use path: user can sign in and view contacts in under 30 seconds.
2. Operational clarity: table/list workflows prioritize scanability, filtering, and quick edits.
3. Mobile viability: all primary workflows are usable on phone widths without horizontal scroll.
4. Accessible by default: keyboard, screen-reader, and reduced-motion experiences are first-class.
5. Trustworthy behavior: explicit loading, success, empty, and failure states on every async action.

---

## 4) Architectural Decisions

### 4.1 Application Model

- Framework: SvelteKit 2 (Svelte 5 runtime)
- Rendering strategy:
  - Auth pages: client-rendered with lightweight SSR shell
  - Dashboard pages: SSR-friendly shell + client data hydration
- Routing model: SvelteKit filesystem routes

### 4.2 Proposed Structure

```text
frontend/
  src/
    lib/
      api/
        client.ts
        auth.ts
        contacts.ts
        errors.ts
      stores/
        auth.store.ts
        tenant.store.ts
        ui.store.ts
      components/
        common/
        forms/
        contacts/
        layout/
      styles/
        tokens.css
        base.css
        utilities.css
        motion.css
      utils/
        validation.ts
        a11y.ts
        telemetry.ts
    routes/
      +layout.svelte
      +error.svelte
      login/+page.svelte
      dashboard/+layout.svelte
      dashboard/+page.svelte
      dashboard/contacts/+page.svelte
      dashboard/contacts/new/+page.svelte
      dashboard/contacts/[id]/+page.svelte
      dashboard/contacts/[id]/edit/+page.svelte
      dashboard/settings/+page.svelte
```

### 4.3 State Strategy

- Server state: API-driven data loaded per route or via typed services.
- Client app state (stores):
  - `auth.store`: auth status + access token metadata only (refresh token is never stored here)
  - `tenant.store`: active tenant id and validation status
  - `ui.store`: toasts, modal visibility, transient UI flags
- Rule: avoid duplicating server state in global stores unless there is a proven UX reason.

---

## 5) API Integration Contract

Backend surface:
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET|POST|PUT|DELETE /api/contacts...`
- `GET /api/health`

### 5.1 Contract Decisions (Locked)
- DG-1: v1.1 uses body-based refresh/logout requests (`{ refreshToken }`), and logout requires bearer auth.
- DG-2: backend enforces route scopes; frontend v1.1 does not gate UI behavior on scope claims.
- DG-3: backend remains paging-only for contacts in v1.1; interim search/sort is client-side within current page only.

### 5.2 Request/Response Contracts (Exact JSON keys)

| Endpoint | Request body | Response body |
|---|---|---|
| `POST /api/auth/login` | `{ "username": "string", "password": "string" }` | `{ "accessToken": "string", "refreshToken": "string", "expiresAt": "ISO-8601" }` |
| `POST /api/auth/refresh` | `{ "refreshToken": "string" }` | `{ "accessToken": "string", "refreshToken": "string", "expiresAt": "ISO-8601" }` |
| `POST /api/auth/logout` | `{ "refreshToken": "string" }` | `{ "success": true }` |
| `GET /api/contacts` | query: `page`, `pageSize` | `{ "items": ContactResponse[], "page": number, "pageSize": number, "totalCount": number }` |

`ContactResponse` keys:
- `id`, `firstName`, `lastName`, `email`, `phone`, `address`, `metadata`, `createdAt`, `updatedAt`

`ErrorResponse` keys:
- `code`, `message`, `details`, `correlationId`

### 5.3 Header Requirements by Endpoint

| Endpoint group | `Authorization` | `X-Tenant-ID` | `X-Correlation-ID` |
|---|---|---|---|
| `/api/health*` | Not required | Not required | Optional |
| `/api/auth/login` | Not required | Required | Optional (echoed in response) |
| `/api/auth/refresh` | Not required | Required | Optional (echoed in response) |
| `/api/auth/logout` | Required | Required | Optional (echoed in response) |
| `/api/contacts*` | Required | Required | Optional (echoed in response) |

Paging constraint:
- `pageSize` is capped at `100`.

HTTP client standards:
- Use one centralized typed client wrapper.
- Add `X-Correlation-ID` per request.
- Standardize error mapping to a typed UI-safe error model.
- Retry strategy: no automatic retry for mutation requests; controlled retry for idempotent reads only.

---

## 6) Authentication and Session Model

### 6.1 Canonical Token Handling

- Access token: in-memory only (tracked in `auth.store` metadata/state).
- Refresh token: held only in a module-scoped in-memory session variable inside the auth service implementation; never persisted in `auth.store`.
- Refresh tokens are not written to browser storage and are regenerated per server/app instance.
- Frontend must never persist tokens to `localStorage`/`sessionStorage`.

### 6.2 Refresh Flow

1. API returns `401` for expired/invalid access token.
2. Frontend calls `/api/auth/refresh` with `{ refreshToken }` and tenant header.
3. On success: replace in-memory access token, replay original request once.
4. On failure: clear auth state and redirect to `/login`.

### 6.3 Route Protection

- Protected area: `/dashboard/**`
- Public area: `/`, `/login`
- Guard behavior:
  - unauthenticated user in protected route -> redirect to login with return URL
  - authenticated user on login route -> redirect to dashboard

---

## 7) Design System (UI Skill-Aligned)

### 7.1 Visual Direction

Effinsty visual direction is professional, calm, and data-focused.

- Primary intent: trust and clarity
- Accent intent: positive action and status reinforcement
- Avoid novelty-heavy palettes and decorative effects in core workflows

### 7.2 Semantic Tokens (Mandatory)

All color usage must come from semantic tokens, not raw hex in components.

```css
:root {
  --bg: 210 20% 98%;
  --surface: 0 0% 100%;
  --surface-muted: 210 20% 96%;
  --text: 222 47% 11%;
  --text-muted: 215 16% 42%;

  --primary: 214 88% 47%;
  --primary-foreground: 0 0% 100%;
  --accent: 163 78% 36%;
  --accent-foreground: 0 0% 100%;

  --success: 142 70% 36%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --info: 199 89% 48%;

  --border: 214 28% 88%;
  --focus: 214 88% 47%;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-sm: 0 1px 2px hsl(222 47% 11% / 0.08);
  --shadow-md: 0 8px 24px hsl(222 47% 11% / 0.10);
}
```

Dark mode is not shipped in v1.1. The token architecture is future-ready only in v1.1, and the active runtime tokens are the light-mode `:root` set above.
When dark mode is approved (target v1.2), define a parallel dark token set with the same semantic names and switch via a theme attribute (for example `data-theme="dark"`) or `prefers-color-scheme`.

### 7.3 Typography

- Primary font: `Manrope, "Avenir Next", "Segoe UI", sans-serif`
- Mono/data font: `"IBM Plex Mono", "SFMono-Regular", Menlo, monospace`
- Scale:
  - `display`: 2.25rem / 1.15
  - `h1`: 1.875rem / 1.2
  - `h2`: 1.5rem / 1.3
  - `h3`: 1.25rem / 1.35
  - `body`: 1rem / 1.55
  - `caption`: 0.875rem / 1.45

### 7.4 Spacing System

8px base scale:
- 4, 8, 12, 16, 24, 32, 40, 48, 64

Usage rules:
- Component internal spacing: 8/12/16
- Card/content blocks: 16/24
- Section spacing: 32+

---

## 8) Responsive and Layout Strategy

Mobile-first breakpoints:
- Base: 320+
- `sm`: 640+
- `md`: 768+
- `lg`: 1024+
- `xl`: 1280+

Layout behaviors:
- Mobile:
  - single-column content
  - sticky top app bar
  - optional bottom action bar for high-frequency actions
- Tablet/Desktop:
  - persistent left sidebar
  - main content max width and table density controls

Interaction requirements:
- Minimum interactive target: 44x44px
- Minimum spacing between touch targets: 8px
- No hover-only critical actions

---

## 9) CSS Architecture

Standards:
1. Use Tailwind utilities + semantic token-backed classes.
2. Keep global CSS limited to tokens, resets, utilities, and motion primitives.
3. Do not place raw color literals in components.
4. Prefer component variants over one-off class overrides.

Files:
- `tokens.css`: semantic variables
- `base.css`: reset, typography defaults
- `utilities.css`: reusable layout/utilities
- `motion.css`: transition/easing/keyframes

---

## 10) Core Components and UX Contracts

### 10.1 Required Components (v1.1)

- `Button` (primary, secondary, ghost, danger, loading)
- `Input` + `Field` wrapper (label, hint, error)
- `Select`, `Textarea`, `Checkbox`
- `Modal` (focus trap + escape close)
- `Toast` (status + dismiss)
- `Table`/`List` hybrid contact view
- `Pagination`
- `EmptyState`
- `Skeleton`
- `InlineError` and `PageError`

### 10.2 Contact List UX Baseline

Must support:
- Pagination with clear total count
- Empty state with primary CTA
- Row-level actions: view/edit/delete (delete requires confirmation)

v1.1 backend constraint:
- Contacts API supports paging only.
- Any search/sort behavior in v1.1 must be client-side over the currently loaded page and explicitly labeled as such in UI.
- Required search label copy: `Search within page {n} of {totalPages} contacts`.
- Required search placeholder: `Search this page of contacts`.
- Required helper/disclaimer text: `Results are limited to the currently loaded page.`

---

## 11) Accessibility Requirements (WCAG 2.2 AA)

Mandatory criteria:
1. Color contrast >= 4.5:1 for body text; >= 3:1 for large text/UI boundaries.
2. Visible keyboard focus on all interactive controls.
3. Logical tab order and no keyboard traps.
4. Labels for all form controls; errors linked via `aria-describedby`.
5. Async feedback announced via polite/assertive live regions as appropriate.
6. Modal/dialog pattern includes role, labeling, focus trap, and focus return.
7. Supports `prefers-reduced-motion`.

Definition of done for accessibility:
- Keyboard-only pass on login + contacts CRUD flow
- Screen-reader smoke pass (VoiceOver or NVDA)
- Automated `axe` checks in CI for critical pages

---

## 12) Motion and Micro-Interactions

Motion intent: communicate system state, not decorate.

Timing tokens:
- `fast`: 120ms
- `base`: 180ms
- `slow`: 240ms

Allowed animation properties:
- `opacity`, `transform`

Micro-interaction baseline:
- Buttons: hover/focus/active/loading states
- Form fields: focus + validation feedback
- List/table rows: subtle highlight on keyboard focus and hover
- Toasts: enter/exit transitions with reduced-motion fallback

Rule: if `prefers-reduced-motion: reduce`, disable non-essential transitions.

---

## 13) Error Handling and Resilience

Error model categories:
- Validation
- Authentication/authorization
- Network/timeout
- Server/business rule
- Unknown

UI rules:
- Every failed async action shows actionable feedback.
- Destructive operations require user confirmation.
- Retry CTA shown for transient failures.
- Correlation ID exposed in advanced error details panel (for support).

---

## 14) Performance and Quality Budgets

Targets (p75, production):
- LCP < 2.5s
- INP < 200ms
- CLS < 0.1

Budgets:
- Initial JS per route: <= 200KB gzip (target)
- Avoid layout-shifting skeletons and image placeholders.
- Lazy-load non-critical route chunks and heavy components.

Implementation rules:
- Optimize images (`srcset`, modern formats).
- Avoid long main-thread tasks in list rendering.
- Use virtualization only when proven needed by profiling.

---

## 15) Security Requirements

1. Never store auth tokens in browser persistent storage.
2. Enforce strict CSP for production host.
3. Validate and sanitize user-input metadata before render.
4. Use `withCredentials` only for trusted API origin.
5. Do not render untrusted HTML (`{@html}` forbidden unless sanitized and approved).
6. All tenant-scoped requests must include validated tenant context.

---

## 16) Testing Strategy

### 16.1 Unit and Component

- Tools: Vitest + Testing Library (Svelte)
- Coverage priorities:
  - auth and tenant store behaviors
  - API error mapping
  - form validation and field-level errors
  - table/list sorting and pagination logic

### 16.2 E2E

- Tool: Playwright
- Critical flows:
  - login/logout
  - contact create/edit/delete
  - unauthorized redirect behavior
  - tenant header propagation checks

### 16.3 Accessibility Testing

- `axe-core` automated checks for key pages in CI
- Manual keyboard and screen-reader smoke tests per release candidate

---

## 17) Delivery Phases

Phase 1: Foundation (week 1)
- App shell, route scaffolding, API client, auth guard, token strategy

Phase 2: Contacts Core (week 2)
- Contact list + pagination + page-scoped search + detail page

Phase 3: CRUD and Hardening (week 3)
- create/edit/delete flows, robust error handling, toasts, skeletons

Phase 4: Quality Gates (week 4)
- accessibility checks, performance tuning, E2E stabilization, release checklist

---

## 18) Open Questions (Needs Team Decision)

1. Theme support finalization: confirm dark mode release target and delivery scope for v1.2.
2. Contact list density: table-first desktop + card mobile vs unified responsive table.
3. Backend-wide contacts search/sort API (across all pages) is a v1.2 priority and needs API contract design.
4. Analytics provider choice for product events.

---

## 19) Acceptance Checklist

- [ ] SvelteKit-only conventions are used consistently.
- [ ] All UI colors are semantic tokens (no raw color literals in components).
- [ ] Contacts flows pass keyboard-only and screen-reader smoke tests.
- [ ] Auth refresh flow matches agreed backend contract.
- [ ] CI includes unit, E2E, and accessibility checks.
- [ ] Performance budgets are measured in staging before production release.

---

## Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-12 | System | Initial specification |
| 1.1 | 2026-03-12 | Codex | Validated and refactored into decision-based frontend spec aligned with UI-agent methodology |
