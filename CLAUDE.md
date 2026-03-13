# Authentik - SaaS Authentication & Marketing Platform

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
| Auth | Better Auth v1.4.20 (JWT + sessions + 2FA TOTP) |
| Email | Resend (primary) + AWS SES (failover) |
| Task Queue | Trigger.dev v4.4.3 |
| Workflows | Temporal (Go microservice, port 5004) |
| Real-time | Convex (newsletter tracking webhooks) |
| Billing | Stripe subscriptions |
| AI | Google Gemini 2.5 Flash via Vercel AI SDK |
| File Storage | AWS S3 / CloudFlare R2 |
| Visual Editor | Puck v0.21 (newsletters) + Tiptap v3.6 (rich text) |
| Validation | Zod + Drizzle Zod |
| Logging | Pino + Axiom |
| Testing | Playwright |

## Architecture

```
client/          - React SPA (70+ pages, Wouter routing)
server/          - Express API (40+ route files, Drizzle schema)
shared/          - Shared types and schemas
src/trigger/     - Trigger.dev tasks (17 task files)
convex/          - Convex real-time backend (newsletter tracking)
formserver/      - Independent public form hosting app
cardprocessor-go/ - Go microservice (birthday cards, Temporal)
migrations/      - Drizzle database migrations
seeders/         - Database seeders
scripts/         - Dev/build utility scripts
tests/           - Playwright tests
```

## Key Directories

- `server/routes/` - Express route handlers (auth, newsletters, emails, forms, etc.)
- `server/db/schema.ts` - Drizzle schema (30+ tables, ~3000 lines)
- `server/auth.ts` - Better Auth configuration
- `client/src/pages/` - React page components
- `client/src/components/` - Reusable UI components
- `client/src/config/puck/` - Puck editor configuration and blocks

## Build & Dev

```bash
npm run dev              # Start Express + Vite dev server
npm run dev:trigger      # Start Trigger.dev local dev
npm run build            # Production build (Vite + esbuild)
npm run db:push          # Push Drizzle schema to PostgreSQL
npm run db:init          # Initialize database
npm run check            # TypeScript type check
```

## Multi-Tenant Model

- All data is tenant-scoped via `tenantId` column
- Roles: Owner, Administrator, Manager, Employee
- `authenticateToken` middleware validates Better Auth sessions
- `requireTenant` middleware enforces tenant context
- `requireRole` middleware enforces RBAC

## Email System

- **Resend** as primary provider with **AWS SES** as failover
- Rate limiting and retry logic per provider
- Real-time tracking: sent, delivered, opened, clicked, bounced, complained
- Bounce/suppression list management
- Unsubscribe tokens per contact

## Key Conventions

- Use `@trigger.dev/sdk` v4 (NEVER `client.defineJob` from v2)
- Check `result.ok` before accessing `result.output` on `triggerAndWait()`
- Never wrap `triggerAndWait` or `wait` calls in `Promise.all`
- All email HTML is sanitized with XSS library (CSS-preserving config)
- Input validation at API boundaries with Zod + express-validator
- i18n via i18next (client-side)

## Security

- Helmet security headers
- Rate limiting (token bucket for auth, sliding window for API)
- XSS sanitization on all public endpoints
- Tenant isolation at middleware + query level
- GDPR consent tracking (IP, user agent, timestamp)
- Drizzle ORM parameterized queries (SQL injection prevention)
- NEVER hardcode API keys or commit .env files

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
