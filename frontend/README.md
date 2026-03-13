# Effinsty Frontend

SvelteKit frontend for Effinsty, aligned to `frontend.md` v1.1 and FE backlog stories FE-00.2.d, FE-01, and FE-02.1.

## Scripts

- `bun run dev`: start local dev server
- `bun run build`: production build
- `bun run preview`: preview build output
- `bun run lint`: ESLint checks
- `bun run format`: Prettier check
- `bun run typecheck`: Svelte + TypeScript checks
- `bun run test`: watch-mode tests
- `bun run test:ci`: CI-mode tests with coverage
- `bun run test:e2e`: Playwright browser flow coverage
- `bun run perf:budgets`: validate gzip bundle budgets after a build

## Test Focus

- FE-00.2.d contract lock tests for auth/contact/error payload keys and casing
- API client behavior tests for header policy, correlation IDs, timeout, and retry strategy
- Auth store and login route tests for FE-02.1 session and UX behavior

## Operational Docs

- [Security hardening](./docs/security-hardening.md)
- [Release checklist and runbook](./docs/release-runbook.md)
