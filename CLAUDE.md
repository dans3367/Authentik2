# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack multi-tenant SaaS platform for authentication, email marketing, newsletter publishing, birthday card automation, contact management, and subscription billing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Wouter routing |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| State | Redux + Redux Persist + TanStack Query + Convex |
| Backend | Express.js + TypeScript (port 5002) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth v1.4.20 (sessions + 2FA TOTP) |
| Email | Resend (primary) → AWS SES (secondary) → AhaSend (tertiary) |
| Task Queue | Trigger.dev v4.4.3 |
| Real-time | Convex (newsletter tracking via WebSocket subscriptions) |
| Billing | Stripe subscriptions |
| AI | Google Gemini 2.5 Flash via Vercel AI SDK |
| File Storage | AWS S3 / CloudFlare R2 |
| Visual Editor | Puck v0.21 (newsletters) + Tiptap v3.6 (rich text) |
| Validation | Zod + Drizzle Zod |
| Logging | Pino + Axiom |

## Build & Dev

```bash
npm run dev              # Start Express + Vite dev server (single port 5002)
npm run dev:trigger      # Start Trigger.dev local dev
npm run build            # Production build (Vite + esbuild)
npm run db:push          # Push Drizzle schema to PostgreSQL
npm run db:init          # Initialize database (idempotent: creates default tenant + subscription plans)
npm run check            # TypeScript type check
npm run seed:owner-company # Create owner account with default tenant for local dev
npm run build:email-css  # Build Tailwind CSS for email templates
```

## TypeScript Path Aliases

```
@/*       → ./client/src/*
@shared/* → ./shared/*
```

## Architecture

```
client/            - React SPA (70+ pages, Wouter routing)
server/            - Express API (40+ route files)
  routes/          - Express route handlers
  db/              - Database connection (server/db.ts)
  auth.ts          - Better Auth configuration + signup hooks
  middleware/       - Auth, tenant, role, security middleware
shared/            - Shared Drizzle schema + types (shared/schema.ts, ~3000 lines)
src/trigger/       - Trigger.dev tasks (17 task files)
convex/            - Convex real-time backend (newsletter tracking)
formserver/        - Retained but unused public form hosting app
cardprocessor-go/  - Go microservice (birthday cards, Temporal) — largely superseded by Trigger.dev
migrations/        - Drizzle SQL migration files
seeders/           - Database seeders
```

### Single-Port Unified Server

Express on port 5002 serves both the API and the React SPA. In development, Vite middleware provides HMR. In production, Express static-serves the built SPA from `dist/public/`. All `/api/*` requests go to Express routes; everything else falls through to `index.html` for client-side routing.

### Dual-Database Pattern (PostgreSQL + Convex)

PostgreSQL is the source of truth for all business data. Convex mirrors a subset of newsletter data for real-time WebSocket subscriptions (send status, tracking events, aggregated stats). This avoids Convex vendor lock-in for business logic while enabling live dashboards.

- `convex/schema.ts` — `newsletterSends`, `newsletterEvents`, `newsletterListItems`, `newsletterStats`
- Client subscribes via `useQuery(api.newsletterListItems.getList)` for live kanban updates
- Convex is optional — if `CONVEX_URL` is not set, the app degrades gracefully

### Three-Layer Client State

- **Redux** (persisted): Auth state (user, role, tenantId) + UI prefs (menuExpanded, theme)
- **TanStack Query**: Server state from Express API with caching + invalidation
- **Convex**: Real-time newsletter tracking via WebSocket subscriptions

### Better Auth Signup Flow

Signup automatically creates a tenant + company via Better Auth hooks in `server/auth.ts`:
1. Creates `tenants` record (slug auto-generated from email)
2. Creates `companies` record (for onboarding modal)
3. Updates user with `tenantId` + `role: 'Owner'`

Session verification: `authenticateToken` middleware calls `auth.api.getSession()` then cross-checks user in DB for tenant info and active status.

## Multi-Tenant Model

- All data tenant-scoped via `tenantId` column
- Roles: Owner, Administrator, Manager, Employee
- `authenticateToken` → `requireTenant` → `requireRole` middleware chain enforces RBAC
- Tenant isolation enforced at both middleware and query level (explicit WHERE clauses)

## Email System

- **Provider failover**: Resend → SES → AhaSend
- Resend batch API for 5+ recipients, individual sends for 1-4
- Per-recipient tracking via unique `emailTrackingId` (UUID) correlated in Convex
- Webhook processing: Resend/Postmark webhooks → Convex updates send status + inserts event records
- All newsletter HTML sanitized with XSS library (CSS-preserving config) before storage
- Unsubscribe tokens per contact; reactions injected before footer marker

## Internal Service Auth (Trigger.dev → Express)

Trigger.dev tasks authenticate to Express endpoints using HMAC-SHA256 signatures instead of storing auth tokens:
- Headers: `x-internal-service`, `x-internal-timestamp`, `x-internal-signature`
- 5-minute timestamp window prevents replay attacks
- Timing-safe comparison for signature verification
- Middleware: `server/middleware/internal-service-auth.ts`

## Key Conventions

- Use `@trigger.dev/sdk` v4 (NEVER `client.defineJob` from v2)
- Check `result.ok` before accessing `result.output` on `triggerAndWait()`
- Never wrap `triggerAndWait` or `wait` calls in `Promise.all`
- Input validation at API boundaries with Zod + express-validator
- i18n via i18next (client-side)
- Shared schema in `shared/schema.ts` — imported by both server and client for type generation via `createInsertSchema` (Drizzle Zod)

## Security

- Helmet security headers + custom CSP
- Rate limiting (token bucket for auth, sliding window for API)
- XSS sanitization on all public endpoints — **skipped for `/api/webhooks/*`** to preserve external payloads
- CORS allowlist from `CORS_ORIGIN` env var (no wildcards in production)
- GDPR consent tracking (IP, user agent, timestamp)
- Drizzle ORM parameterized queries (SQL injection prevention)
- NEVER hardcode API keys or commit .env files

## Express Middleware Order (Critical)

1. Helmet security headers
2. CORS (dynamic allowlist + localhost in dev)
3. Better Auth handler for `/api/auth/*`
4. Raw body parser for Stripe webhooks (must come before `express.json()`)
5. JSON/URL body parsers
6. Request logging middleware

<!-- TRIGGER.DEV basic START -->
## Trigger.dev Tasks (v4)

**MUST use `@trigger.dev/sdk`, NEVER `client.defineJob`**

### Basic Task

```ts
import { task } from "@trigger.dev/sdk";

export const processData = task({
  id: "process-data",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: { userId: string; data: any[] }) => {
    console.log(`Processing ${payload.data.length} items for user ${payload.userId}`);
    return { processed: payload.data.length };
  },
});
```

### Schema Task (with validation)

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const validatedTask = schemaTask({
  id: "validated-task",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  run: async (payload) => {
    return { message: `Hello ${payload.name}, age ${payload.age}` };
  },
});
```

### Triggering Tasks

#### From Backend Code

```ts
import { tasks } from "@trigger.dev/sdk";
import type { processData } from "./trigger/tasks";

const handle = await tasks.trigger<typeof processData>("process-data", {
  userId: "123",
  data: [{ id: 1 }, { id: 2 }],
});
```

#### From Inside Tasks (Result handling)

```ts
const result = await childTask.triggerAndWait({ data: "value" });
if (result.ok) {
  console.log("Task output:", result.output);
} else {
  console.error("Task failed:", result.error);
}

// Quick unwrap (throws on error)
const output = await childTask.triggerAndWait({ data: "value" }).unwrap();
```

> Never wrap triggerAndWait or batchTriggerAndWait in Promise.all/Promise.allSettled.

### Waits

```ts
import { wait } from "@trigger.dev/sdk";

await wait.for({ seconds: 30 });
await wait.for({ minutes: 5 });
await wait.until({ date: new Date("2024-12-25") });
await wait.forToken({ token: "approval-token", timeoutInSeconds: 3600 });
```

> Never wrap wait calls in Promise.all/Promise.allSettled.

### Key Points

- `triggerAndWait()` returns a `Result` object with `ok`, `output`, `error` - NOT direct output
- Use `import type` for task references when triggering from backend
- Waits > 5 seconds are checkpointed and don't count toward compute

### NEVER Use (v2 deprecated)

```ts
// BREAKS APPLICATION
client.defineJob({ id: "job-id", run: async (payload, io) => {} });
```
<!-- TRIGGER.DEV basic END -->
