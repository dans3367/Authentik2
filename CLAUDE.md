# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack multi-tenant SaaS platform (branded "Zendwise") built with React + Express + PostgreSQL. Provides email marketing (campaigns, newsletters, birthday emails), contact management, form builder, appointment scheduling, and subscription billing.

## Commands

```bash
npm run dev              # Start all 3 servers concurrently (main, webhook, bounce)
npm run dev:server       # Backend only
npm run dev:trigger      # Trigger.dev background job worker
npm run build            # Production build (Vite + esbuild)
npm run check            # TypeScript type checking
npm run db:push          # Push Drizzle schema changes to DB
npm run db:init          # Initialize database
npm run seed:owner-company  # Seed initial data
```

No test runner script. Manual test scripts in `tests/` — run individually:
```bash
node tests/test-newsletter-flow.js
```

## Architecture

### Three concurrent servers (`npm run dev`)

| Server | Port | Entry | Purpose |
|--------|------|-------|---------|
| Main | 5002 | `server/index.ts` | Express API + React frontend + public forms |
| Webhook | 3505 | `server-hook/index.ts` | Resend email event webhooks |
| Bounce | 5003 | `webhook-bounces/index.ts` | Email suppression/bounce webhooks |

Real-time newsletter engagement tracking is handled by **Convex** (`convex/`), a separate BaaS.

### Monorepo layout

```
client/src/         React frontend (Vite, React 18)
  components/       UI components (shadcn/ui + Radix)
  pages/            67+ lazy-loaded pages
  hooks/            Custom hooks (useAuth, useTenantPlan, useRealtimeNewsletters, etc.)
  store/            Redux Toolkit slices (auth, shop)
  lib/              API client, auth, validators
server/             Express backend
  routes/           49 route files
  middleware/       auth, security, shop-filter
  services/         Birthday, stats services
  providers/        Email provider adapters (Resend, AWS SES)
  lib/              Trigger.dev integration
shared/
  schema.ts         ALL Drizzle table definitions + Zod schemas (~3000 lines)
convex/             Real-time tracking (newsletter opens/clicks)
migrations/         Drizzle migration files
```

### Path aliases

```ts
@/*        →  client/src/*
@shared/*  →  shared/*
```

## Key Conventions

### Database schema

All Drizzle ORM table definitions live in **`shared/schema.ts`** — never create tables elsewhere. Drizzle Zod schemas (`createInsertSchema`) are generated in the same file and used for validation on both client and server.

### Authentication

Uses **better-auth** with cookie-based sessions. The `authenticateToken` middleware (`server/middleware/auth-middleware.ts`) populates `req.user` with `{ id, email, role, tenantId, firstName, lastName, ... }`.

```ts
router.get('/resource', authenticateToken, requireTenant, handler);
```

Frontend: use `useAuth()` hook from `client/src/hooks/useAuth.ts`. Do not read auth state from Redux directly — use `useReduxAuth()` which wraps `useAuth()`.

### Multi-tenancy

Every query that reads or writes tenant-owned data **must** include a `tenantId` filter from `req.user.tenantId`. No automatic row-level security — enforcement is manual in every route handler.

### Frontend patterns

- **TanStack Query** for all API data fetching/caching
- **Redux Toolkit + redux-persist** for app state (auth session, selected shop)
- **Convex hooks** for real-time newsletter tracking
- **Wouter** for routing (not React Router) — all pages lazy-loaded in `client/src/App.tsx`
- **React Hook Form + Zod** for form validation — reuse schemas from `@shared/schema`
- API calls via `apiRequest(method, url, body?)` from `client/src/lib/queryClient.ts` — handles auth headers; 401s trigger global sign-out

### Error responses

Backend returns `{ message: string }` JSON. Status codes: 400 validation, 401 unauthenticated, 403 forbidden/tenant mismatch, 404 not found.

### Email HTML sanitization

Sanitize with `xss` package configured with `css: false` to preserve email-critical CSS. Pre-process `url("...")` → `url('...')` before parsing to prevent attribute truncation.

### Background jobs

Trigger.dev v4 handles transactional email, birthday cards, appointment reminders. Task definitions in `server/lib/trigger.ts`, config in `trigger.config.ts`.

### Security middleware

Helmet, express-rate-limit, express-mongo-sanitize, CORS with origin allowlist. Internal service auth uses `X-Internal-Service` header. Shop-filter middleware validates shop ownership.

## Environment

Copy `env.example` to `.env`. Key required variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `BASE_URL`, `PORT` (default 5002).
