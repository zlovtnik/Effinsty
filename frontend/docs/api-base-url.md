# Frontend API Base URL Configuration

This guide shows where to configure the backend API URL in the Effinsty frontend.

## Primary Location: HTTP Config

Edit [`frontend/src/lib/infrastructure/config/http-config.ts`](/Users/rcs/git/Effinsty/frontend/src/lib/infrastructure/config/http-config.ts):

```ts
export const HTTP_CONFIG: HttpConfig = {
  baseUrl: import.meta.env.PUBLIC_API_URL?.trim() || '/api',
  timeoutMs: 10_000,
  // ...
};
```

Recommended values for `PUBLIC_API_URL`:

- Development proxy or same-origin backend: `/api`
- Separate local backend: `http://localhost:3000/api`
- Production: `https://your-api-domain.com/api`

If you provide only an origin (for example `https://api.example.com/`), the client now normalizes it to `https://api.example.com/api`.

## Secondary Location: Runtime Overrides

The request client keeps runtime override support in [`frontend/src/lib/infrastructure/http/client.ts`](/Users/rcs/git/Effinsty/frontend/src/lib/infrastructure/http/client.ts):

- Per request: `request(path, { baseUrl: '...' })`
- Per client: `createHttpClient({ baseUrl: '...' })`

Base URL precedence is:

1. `RequestOptions.baseUrl`
2. `createHttpClient({ baseUrl })`
3. `PUBLIC_API_URL`
4. `/api`

## Environment Setup (Recommended)

For this repo, Vite is configured to load env files from the repository root (`envDir: ..`), so set this in `/.env` or `/.env.local`:

```bash
PUBLIC_API_URL=https://api.yourdomain.com/api
```

An example template is provided at [`frontend/.env.example`](/Users/rcs/git/Effinsty/frontend/.env.example).

## Validation

- Check browser DevTools Network URLs for requests like:
  - `POST /api/auth/login`
  - `GET /api/contacts`
  - `POST /api/contacts/{id}`
- Confirm requests resolve against the expected base URL in each environment.
