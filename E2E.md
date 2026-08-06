# E2E Tests

This project has two complementary E2E harnesses that exercise the **live server**
(instead of mocked modules) so that NextAuth (`src/lib/auth.ts`) — which unit
tests must mock — is exercised through a **real** credentials login flow.

## 1. Playwright (HTTP request-level) — `npm run test:e2e`

A lightweight, browser-free suite using Playwright's HTTP `request` fixture. It
hits every `/api/*` route, performs a real NextAuth credentials login, and
walks the registration → applicant → member conversion lifecycle.

```bash
npm run test:e2e
```

Playwright auto-starts the production server (webServer config) on port `3310`
(`scripts/e2e-server.ts` resets + seeds the DB, and auto-builds if no
production build exists), so you just need Postgres. To build first then run
(CI):

```bash
npm run test:e2e:ci
```

> ⚠️ If you get `Browser was not found`, the sandbox couldn't download the
> browser binary (large download). This suite is **browser-free** and does **not**
> need a browser — the `@playwright/test` package is only used for the HTTP
> `request` fixture and the `webServer` auto-boot. No Chrome install required.
> Just run `npm install` then `npm run test:e2e`.

## 2. Standalone HTTP orchestrator — `npm run test:e2e:http`

A zero-browser orchestrator (`scripts/e2e.ts`) that:
1. Resets + seeds the database (`db:reset`),
2. Starts `next start -p 3310` as a subprocess,
3. Waits for readiness,
4. Runs `scripts/smoke-test.ts` (real NextAuth login + PRD checklist),
5. Tears the server down and propagates the smoke exit code.

```bash
npm run test:e2e:http
```

Use `--` to pass the env to the server, e.g.:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dcms npm run test:e2e:http
```

## Test accounts (from `prisma/seed.ts`)

| Role  | Email              | Password |
| ----- | ------------------ | -------- |
| Admin | `admin@dcms.local` | `admin123` |
| Member| `demo@dcms.local`  | `demo123` |

## CI (GitHub Actions)

Both harnesses are designed to run in CI. The webServer in `playwright.config.ts`
starts the server automatically, and `test:e2e:http` is a single self-contained
command. A Postgres service is the only external requirement.

## What this covers that unit tests can't

- `src/lib/auth.ts` — NextAuth `authorize`, `jwt`, and `session` callbacks run
  for real on login and the `/api/session` call.
- The full request pipeline: NextAuth session (`auth()` via `requireAuth`) → RBAC
  (`requirePermission`) → Zod validation → Prisma → email/R2 (gracefully skipped
  if unconfigured).
- Public-vs-private route protection and CSRF validation.
