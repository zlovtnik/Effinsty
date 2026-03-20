# Effinsty Form 720
## Frontend Development Specification

**Version:** 1.0  
**Date:** 2026-03-16  
**Status:** Draft for implementation  
**Depends On:** `docs/form720-backend-database-dev-spec.md`

---

## 1. Purpose

Define the SvelteKit frontend implementation for Form 720 workflows in Effinsty:

- Return list and search
- Return creation and editing
- Line-item management
- Validation and submission workflows
- Status tracking and audit trail visibility

This spec assumes existing authentication, tenant, error-handling, and API client conventions in the current frontend codebase.

---

## 2. UX Scope

### 2.1 In Scope

- Desktop and mobile-responsive Form 720 pages
- Workflow from draft to submission
- Validation error display with field-level mapping
- Audit trail and filing transaction status views

### 2.2 Out of Scope

- Mobile-native app
- PDF rendering/export
- External tax calculation widgets

---

## 3. Route Map

Add SvelteKit routes under `/dashboard/returns`:

- `/dashboard/returns` list page
- `/dashboard/returns/new` create draft
- `/dashboard/returns/[id]` return detail summary
- `/dashboard/returns/[id]/edit` editable return shell
- `/dashboard/returns/[id]/line-items` line-item editor
- `/dashboard/returns/[id]/review` validation + submit readiness
- `/dashboard/returns/[id]/audit` audit trail timeline

Route conventions should mirror the existing controller pattern:

- `*.controller.svelte.ts` for page orchestration
- `+page.svelte` for rendering
- colocated tests in `__tests__`

---

## 4. API Integration Contracts

### 4.1 New Frontend API Module

Create `frontend/src/lib/api/returns.ts` with functions:

- `listReturns(params: ListReturnsParams)`
- `createReturn(payload)`
- `getReturn(id)`
- `updateReturn(id, payload)`
- `deleteDraftReturn(id)`
- `validateReturn(id)`
- `submitReturn(id, options: SubmitReturnOptions)`
- `getReturnStatus(id)`
- `listReturnAuditTrail(id)`
- `addLineItem(id, payload)`
- `removeLineItem(id, lineId)`

`listReturns` params contract:

```ts
interface ListReturnsParams {
  page?: number; // default 1
  pageSize?: number; // default 20
  year?: number | string;
  quarter?: 1 | 2 | 3 | 4 | string;
  status?: string;
  org?: string; // org id
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

`submitReturn` idempotency + retry contract:

```ts
interface SubmitReturnOptions {
  idempotencyKey: string;
}
```

- `submitReturn` must send `idempotencyKey` as an `Idempotency-Key` header.
- Callers generate one unique key per logical submit operation and reuse it for retries.
- Server duplicate-key behavior: treat duplicate requests with the same key as idempotent replay and return the original submission outcome.
- Client retry policy: retry network errors/timeouts with exponential backoff (max 3 retries), do not retry 4xx client errors.
- Ambiguous response handling: call `getReturnStatus(id)` before retrying a timed-out submit to avoid duplicate submissions.

### 4.2 Shared Types

Create `frontend/src/lib/services/returns/returns.types.ts`:

- `ReturnStatus`
- `FilingType`
- `TransmissionStatus`
- `Form720Return`
- `ReturnLineItem`
- `FilingTransaction`
- `ReturnAuditEvent`
- request/response payload interfaces

### 4.3 Error Mapping

Extend error mapper logic for:

- `validation_error`
- `conflict`
- `irs_transmission_error`
- `service_unavailable`

Display correlation ID in failure states using existing presenter patterns.

---

## 5. State Management

Add stores:

- `frontend/src/lib/stores/returns.store.ts`
- `frontend/src/lib/stores/return-draft.store.ts`

### 5.1 `returns.store`

Responsibilities:

- Paginated list state
- Active filters: year, quarter, status, org
- Refresh and optimistic cache invalidation

### 5.2 `return-draft.store`

Responsibilities:

- Draft metadata fields
- Line-item collection and derived totals
- Dirty-state tracking
- Validation result cache
- Submit eligibility flag

### 5.3 Unsaved Changes

- Warn on browser refresh/tab close/navigation when dirty-state tracking is true.
- Route changes from edit/review pages require explicit confirmation if unsaved changes exist.
- Confirmation actions: stay and continue editing, discard local changes, or save-and-leave.

### 5.4 Auto-save vs Manual Save

- Autosave cadence: debounce edits for 5 seconds and batch pending draft + line-item changes into one save operation.
- Trigger immediate save on explicit user action (`Save`, `Validate`, `Submit`).
- Show visible save state (`Saving...`, `Saved`, `Save failed`) and last-saved timestamp.
- On repeated save failures, disable silent autosave and present manual retry controls.

### 5.5 Conflict Resolution

- Use versioning (`versionNo`) or HTTP ETags on return resources.
- On version conflict (409/412), present conflict dialog with server snapshot and local unsaved snapshot.
- User actions: overwrite with local copy, accept server copy, or merge line-item edits manually.
- Keep validation result cache scoped to the winning version after conflict resolution.

### 5.6 Stale Data Detection & Recovery

- Run periodic lightweight freshness checks (every 60 seconds while editing).
- If stale server data is detected, invalidate optimistic UI and mark submit eligibility as pending refresh.
- User actions: reload server data, reconcile differences, or keep editing locally then resolve conflict on save.

---

## 6. UI Component Inventory

Create components under `frontend/src/lib/components/returns`:

- `ReturnsTable.svelte`
- `ReturnStatusBadge.svelte`
- `ReturnSummaryCard.svelte`
- `LineItemTable.svelte`
- `LineItemEditorDialog.svelte`
- `ValidationIssuesPanel.svelte`
- `SubmissionTimeline.svelte`
- `AuditTrailList.svelte`

Reuse existing UI primitives from `frontend/src/lib/components/ui` and `frontend/src/lib/components/common`.

---

## 7. Interaction Flows

### 7.1 Create Draft

1. User opens `/dashboard/returns/new`.
2. Enters org/year/quarter/filing type.
3. Client validates required fields and period rules.
4. Calls `createReturn` with retry on transient failures (max 3 attempts, exponential backoff).
5. If network unavailable, queue request locally and show `Pending sync` state.
6. If session timeout is detected, autosave local draft payload, redirect to re-auth, then resume create flow.
7. Redirect to `/dashboard/returns/[id]/edit` on success.

### 7.2 Edit + Line Items

1. Load return summary + line items.
2. Add/edit/delete line items.
3. Recalculate totals locally for immediate feedback.
4. Persist through API calls (`addLineItem`, `removeLineItem`, update draft) with user-visible retry controls.
5. Queue line-item mutations offline when disconnected and replay in order after reconnect.
6. On auth expiry during persistence, preserve unsynced queue, prompt re-auth, and retry queue replay.

### 7.3 Validate

1. User clicks `Validate`.
2. Trigger `validateReturn(id)` with retry on transient failures.
3. `ValidationIssuesPanel` separates blocking errors from recoverable warnings.
4. Recoverable issues support `Retry validation` and `Rollback latest edit`; blocking issues prevent submit.
5. Reflect status badge updates.
6. If validation call fails after retries, keep cached validation state and show manual retry path.

### 7.4 Submit

1. User clicks `Submit` only when validation is clean.
2. Confirm dialog with irreversible action warning.
3. Trigger `submitReturn(id, { idempotencyKey })`.
4. Handle IRS transmission errors with bounded retries and clear failure messaging.
5. Poll status endpoint until terminal status or timeout using:
   - initial interval: 2s
   - backoff: exponential (`next = min(8s, 2s * 2^attempt)`) with ±20% jitter
   - stop conditions: terminal status, 12 attempts, or 120s elapsed (whichever comes first)
6. Show progress indicator with elapsed time and retry count during polling.
7. On polling failure/timeout, notify user, keep idempotency key context, and offer `Retry polling`, `Resume later`, or `Contact support`.
8. Display IRS receipt/confirmation if available.
9. Recovery options for failed validation/submission: undo latest edits, correct and resubmit, or escalate via support runbook.

---

## 8. Form and Field Rules

### 8.1 Return Header Fields

- `orgId`: required
- `taxYear`: required numeric
- `taxQuarter`: required, values `1-4`
- `filingType`: required enum
- `notes`: optional, max length 5000

### 8.2 Line Item Fields

- `scheduleCode`: required
- `taxCode`: required
- `description`: optional
- `quantity`: optional numeric
- `rate`: optional numeric
- `amount`: required numeric >= 0

### 8.3 Additional Business Rules

- `taxYear`/`taxQuarter` cannot be in the future.
- When `return.status === 'SUBMITTED'`, edits are blocked client-side.
- Duplicate prevention for active returns: check client cache for existing `orgId + taxYear + taxQuarter`, then confirm with backend on create.
- Conditional required fields apply by schedule/tax code combinations (for example, schedule `X` requires field `Y`).
- Arithmetic validation: if `quantity` and `rate` are present, enforce `amount === quantity * rate`.
- Non-negative validation: `amount >= 0` is enforced client-side and reconciled with backend response.

Validation should run client-side first, then reconcile with backend response errors.

---

## 9. Accessibility and UX Constraints

- Keyboard access for table actions and dialogs
- Screen-reader labels on validation summaries and status badges
- Focus management for async validation/submit transitions
- ARIA live region updates on status changes
- Preserve existing frontend color token system and error severity semantics

---

## 10. Telemetry Requirements

Emit frontend telemetry events with correlation context:

- `returns_list_loaded`
- `return_created`
- `line_item_added`
- `return_validated`
- `return_submitted`
- `return_submission_failed`

Event payload minimum fields:

- `route`
- `tenantId` (non-sensitive identifier only)
- `returnId` (if available)
- `correlationId`
- `durationMs`

---

## 11. Test Strategy

### 11.1 Unit Tests

- Controller orchestration behavior
- Store reducers/actions
- Validation helpers and totals calculation

### 11.2 Component Tests

- Table rendering and pagination
- Status badge state mapping
- Validation panel formatting
- Audit trail timeline rendering

### 11.3 Accessibility Tests

- Axe checks for each route
- Dialog focus trap and escape handling
- Error summary announcement behavior

### 11.4 E2E Tests

- Create -> edit -> validate -> submit happy path
- Validation failure path
- Retry/resume behavior when submit API fails
- Access control path (scope-restricted actions hidden/blocked)

### 11.5 API Module Integration Tests (`returns.ts`)

- Mock HTTP responses for list/get/create/update/delete/validate/submit/status and line-item calls.
- Verify request shaping (query params, headers including idempotency key), response mapping, and error mapping.
- Verify retry behavior for transient failures and no-retry behavior for non-retryable 4xx responses.

### 11.6 API Mocking Strategy

- Use MSW as the primary API mocking approach for integration tests and local development.
- Keep manual function-level mocks as fallback for low-level unit tests and CI troubleshooting.
- Stub network edge cases explicitly: 400 validation payloads, 401/403 auth errors, 409 conflicts, 500/503 transient failures, timeouts, and offline/disconnect behavior.

### 11.7 Test Data Management

- Maintain realistic reusable fixtures for returns, line items, validation errors, and IRS submission/status payloads.
- Preferred fixture locations:
  - `frontend/src/lib/api/__tests__/fixtures/returns/*.json`
  - `frontend/src/lib/api/__tests__/factories/returns.factory.ts`
- Factory functions produce minimal/valid/default payloads with targeted overrides for edge cases.
- Reuse the same fixture contracts across integration tests and E2E tests to reduce drift.

---

## 12. Delivery Checklist

- New routes and controllers added
- `returns.ts` API module implemented + tested
- Stores implemented + tested
- Returns components implemented + tested
- A11y checks passing for all new routes
- E2E flow coverage for key return lifecycle paths
- Runbook notes updated in `frontend/docs/release-runbook.md`
