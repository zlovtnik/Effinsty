# Accessibility Smoke Test Notes

## 2026-03-13
- Scope: login page and contacts list/detail routes.
- Assistive tech: NVDA 2026.1 (manual smoke run pending in local QA environment).
- Scenario 1: Keyboard navigation through login form fields and submit flow.
  - Expected:
    - Tab order enters tenant, username, password, submit button.
    - Enter key submits form.
    - Error states announced via polite/assertive live region updates.
  - Recorded outcome:
    - Automated checks added for WCAG critical/serious violations via `test:a11y`.
    - Manual NVDA verification is not executed in this code environment.
- Scenario 2: Contacts list interactions (search, pagination, row actions).
  - Expected:
    - Keyboard focus remains on actionable controls.
    - Sort and pagination controls are reachable and labeled.
    - Delete confirmation and retry actions announce outcomes.
  - Recorded outcome:
    - Automated checks added for route-level page states.
    - No blocker found at automation level; manual screen-reader smoke remains pending.
- Blocking items:
  - None from code-time execution. Manual AT verification should confirm phrasing of live announcements.
