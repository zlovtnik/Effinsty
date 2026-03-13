# Frontend Security Hardening

## Session handling

- Auth state is memory-only. `authStore` and `sessionStore` are the only allowed token holders.
- Browser `localStorage` and `sessionStorage` are forbidden for tokens, refresh tokens, or session recovery state.
- A full page refresh clears the in-memory session and requires re-authentication.

## Raw HTML policy

- Untrusted HTML rendering is forbidden.
- `{@html}` is blocked by ESLint via `svelte/no-at-html-tags`.
- Any future exception would require an approved sanitization layer and a documented threat review.

## CSP deployment checklist

- Serve CSP headers at the edge, reverse proxy, or platform ingress. Do not rely on a `<meta http-equiv>` fallback.
- Start from a deny-by-default policy:

```text
Content-Security-Policy:
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  img-src 'self' data:;
  font-src 'self';
  style-src 'self' 'unsafe-inline';
  script-src 'self';
  connect-src 'self';
  form-action 'self';
```

- `style-src 'self' 'unsafe-inline'` is a temporary concession, not the target end state.
- It is still required by current inline style usage in [`frontend/src/app.html`](/Users/rcs/git/Effinsty/frontend/src/app.html) and component-generated inline widths such as [`frontend/src/lib/components/ui/Skeleton.svelte`](/Users/rcs/git/Effinsty/frontend/src/lib/components/ui/Skeleton.svelte).
- Remediation plan:
  1. Remove static inline styles in app shell markup.
  2. Replace runtime `style=` attribute usage with classes or CSS custom properties that work under a strict CSP.
  3. After inline styles are eliminated, tighten `style-src` to a nonce- or hash-based policy and validate it in staging before rollout.
- Review every third-party dependency before widening `script-src`, `style-src`, `img-src`, or `connect-src`.
- Prefer host allowlists over broad wildcards.
- If report collection is available, add `report-to` or `report-uri` during rollout and monitor violations before tightening further.
- Keep API calls scoped to the expected frontend origin and `/api/*` backend path.
- Re-check CSP whenever analytics, Web Vitals export, or external assets are introduced.

## Verification checklist

- `bun run lint` passes with storage/raw-HTML guards enabled.
- Authentication still works with refresh tokens held in memory only.
- Error UIs continue to display correlation IDs without exposing secrets.
