# Frontend Release Checklist and Runbook

## Release checklist

- Run `bun run lint`
- Run `bun run typecheck`
- Run `bun run test:ci`
- Run `bun run build`
- Run `node scripts/check-bundle-budgets.mjs`
- Run `bun run test:e2e`
- Confirm CSP headers are configured in the target environment
- Confirm `PUBLIC_ENABLE_WEB_VITALS` is only enabled in staging or approved environments
- Confirm health polling renders a healthy/degraded badge in the dashboard shell

## Incident triage with correlation IDs

- Reproduce the failing path and capture the correlation ID from the login alert, error panel, or toast.
- Search backend/API logs by `X-Correlation-ID` first.
- Compare the frontend console telemetry event with the backend request log to verify route, tenant, and action name.
- If the failure came from health polling, inspect `/api/health` availability and ingress/network policy before blaming feature code.

## Rollback criteria

- Roll back immediately if login, token refresh, contact CRUD, or logout regress in production.
- Roll back if bundle budget enforcement is bypassed and the shipped bundle exceeds the defined thresholds.
- Roll back if health polling causes repeated degraded status because of frontend-only behavior rather than backend availability.

## Feature-flag fallback points

- Disable `PUBLIC_ENABLE_WEB_VITALS` to stop client-side Web Vitals emission without touching core UX flows.
- Leave the telemetry sink on the built-in console sink if a provider adapter fails or is incomplete.
- If dashboard health polling is noisy during rollout, stop the polling hook in the dashboard shell while keeping the rest of the telemetry instrumentation in place.
