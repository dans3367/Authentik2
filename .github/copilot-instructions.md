# Copilot Instructions

## Project Overview

Full-stack multi-tenant SaaS platform (displayed as "Zendwise") providing user authentication, email marketing (campaigns, newsletters, birthday emails), contact management, form builder, and subscription billing.

## Commands

```bash
# Development (starts all 3 servers concurrently)
npm run dev

# Backend only
npm run dev:server

# Type checking
npm run check

# Production build
npm run build

# Database
npm run db:push        # Push schema changes to DB
npm run db:init        # Initialize database

# Seeders
npm run seed:owner-company
```

There is no test runner script. Manual test scripts live in `tests/` (Playwright + shell scripts). Run them individually, e.g.:
```bash
node tests/test-newsletter-flow.js
npx playwright test tests/comprehensive-test.sh
```

## Architecture

### Three concurrent servers

`npm run dev` (via `scripts/start-dev.js`) spawns:

| Server | Port | Entry | Purpose |
|--------|------|-------|---------|
| Main | 5002 | `server/index.ts` | Express API + React frontend + public forms |
| Webhook | 3505 | `server-hook/index.ts` | Resend email event webhooks |
| Bounce | 5003 | `webhook-bounces/index.ts` | Email suppression/bounce webhooks |

Real-time newsletter engagement is handled by **Convex** (`convex/`), a separate BaaS.

### Monorepo layout

```
client/src/       React frontend (Vite)
server/           Express backend
  routes/         43 route files
  middleware/     auth, security, shop-filter
  workers/        background jobs (SessionCleanupWorker)
  providers/      email provider adapters
shared/           Shared between client & server
  schema.ts       ALL Drizzle table definitions (~3000 lines)
server-hook/      Resend webhook receiver (standalone Express)
webhook-bounces/  Bounce/suppression webhook receiver
convex/           Real-time tracking (newsletter opens/clicks)
migrations/       Drizzle migration files
tests/            Manual test scripts
```

### Path aliases

```ts
@/*        →  client/src/*
@shared/*  →  shared/*
```

## Key Conventions

### Database schema

All Drizzle ORM table definitions live in **`shared/schema.ts`** — never create tables elsewhere. Drizzle Zod schemas (`createInsertSchema`) are generated from tables in the same file and used for validation on both client and server.

### Authentication

Authentication uses **better-auth**. The `authenticateToken` middleware (`server/middleware/auth-middleware.ts`) wraps better-auth's session verification and populates `req.user` with `{ id, email, role, tenantId, ... }`. Use `requireTenant` middleware when a route requires tenant isolation.

```ts
// Protecting a route
router.get('/resource', authenticateToken, requireTenant, handler);
```

For the frontend, use the `useAuth()` hook (`client/src/hooks/useAuth.ts`); do **not** read auth state from Redux directly (use `useReduxAuth()` which wraps `useAuth()`).

### Multi-tenancy

Every query that reads or writes tenant-owned data **must** include a `tenantId` filter. The tenant ID comes from `req.user.tenantId` on the server. There is no automatic row-level security at the DB level — enforcement is manual in route handlers.

### Frontend state

- **TanStack Query** — all API data fetching/caching
- **Redux Toolkit + redux-persist** — app state (auth session, selected shop)
- **Convex hooks** — real-time newsletter tracking data

### Routing

Uses **Wouter** (not React Router). All pages are lazy-loaded in `client/src/App.tsx` via `React.lazy()`. Add new routes there.

### API requests

Use `apiRequest(method, url, body?)` from `client/src/lib/queryClient.ts` for all API calls. It handles auth headers and throws `"${status}: ${message}"` errors. 401 responses are caught globally and trigger a sign-out flow.

### Form validation

Use **React Hook Form** + **Zod** on the frontend. Reuse Drizzle-generated Zod schemas from `@shared/schema` where possible to avoid duplication.

### Email HTML sanitization

Email HTML **must** be sanitized with the `xss` package configured with `css: false` to preserve email-critical CSS. Pre-process `url("...")` → `url('...')` before parsing to prevent attribute truncation (see `server/routes/email/` for existing usage).

### Error responses

Backend routes return `{ message: string }` JSON for errors. Status codes: 400 validation, 401 unauthenticated, 403 forbidden/tenant mismatch, 404 not found.

## Environment Variables

Copy `env.example` to `.env`. Required variables:

```
DATABASE_URL          PostgreSQL connection string
BETTER_AUTH_SECRET    Secret for better-auth session signing
STRIPE_SECRET_KEY     Stripe API key
RESEND_API_KEY        Resend email API key
BASE_URL              Public URL of the app (e.g. http://localhost:5002)
PORT                  Main server port (default: 5002)
```

## Trigger.dev

Background jobs (transactional email, birthday cards, etc.) are dispatched via `server/lib/trigger.ts` using **Trigger.dev v4**. Job definitions are in the root `trigger.config.ts`. To run the Trigger.dev dev worker:

```bash
npm run dev:trigger
```
