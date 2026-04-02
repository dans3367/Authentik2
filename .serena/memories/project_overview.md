# Authentik - Project Overview

## Purpose
Authentik is a multi-tenant SaaS platform for business management, focusing on:
- Email marketing & newsletters (with Puck drag-and-drop editor)
- Email contact management, segmentation, and campaigns
- Appointment scheduling & reminders
- E-cards & birthday cards
- Shops & promotions management
- Forms (embeddable public forms)
- Subscription billing (Free/Plus/Pro tiers via Stripe)

## Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS 3, shadcn/ui (Radix primitives), Lucide icons, wouter (routing), React Query, Redux Toolkit, react-hook-form + zod
- **Backend**: Express 4 (Node.js, ESM), TypeScript 5.6
- **Database**: PostgreSQL via Drizzle ORM (schema in `shared/schema.ts`, migrations in `migrations/`)
- **Real-time**: Convex (newsletter tracking, webhook handlers)
- **Auth**: Better Auth (scrypt password hashing), 2FA support
- **Email Providers**: Resend, AhaSend, AWS SES
- **Background Jobs**: Trigger.dev v4 (tasks in `src/trigger/`)
- **Payments**: Stripe (subscriptions, checkout)
- **Logging**: Pino, Axiom (activity logs dual-write)
- **Image Processing**: Sharp, Cloudflare R2 (S3-compatible storage)
- **i18n**: i18next (en, es locales in `client/src/i18n/locales/`)

## Architecture
- Monorepo with shared schema between client and server
- `client/` - React SPA (Vite dev server on port 5173, proxies /api to 5002)
- `server/` - Express API server (port 5002)
- `shared/` - Drizzle schema & shared types
- `convex/` - Convex functions (real-time newsletter tracking, webhooks)
- `src/trigger/` - Trigger.dev background tasks
- `server-hook/` - Standalone webhook server (port 3505)
- `webhook-bounces/` - Bounce webhook server (port 5003)
- `formserver/` - Standalone form server (backend 3004, frontend 3002)
- `migrations/` - Drizzle SQL migrations
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
