# Suggested Commands

## Development
- `npm run dev` — Start main dev server (Vite + Express via `scripts/start-dev.js`)
- `npm run dev:server` — Start only the Express server (`tsx server/index.ts`)
- `npm run dev:trigger` — Start Trigger.dev dev worker
- `./start.sh` — Start all services (main server + webhook + bounce webhook)
- `./start.sh --npm-dev` — Start via npm run dev (recommended for development)
- `./start.sh stop` — Stop all services

## Database
- `npm run db:push` — Push Drizzle schema to DB (`drizzle-kit push`)
- `npm run db:init` — Initialize DB (`tsx server/init-db.ts`)
- `npx drizzle-kit generate` — Generate a new migration from schema changes

## Build & Deploy
- `npm run build` — Build for production (email CSS + Vite + esbuild server)
- `npm run start` — Run production build
- `npm run check` — TypeScript type checking (`tsc --noEmit`)

## Seeding & Utilities
- `npm run seed:owner-company` — Seed owner company
- `npm run user:set-owner` — Set a user as owner
- `npm run build:email-css` — Build email CSS with Tailwind

## Convex
- `npx convex dev` — Start Convex dev environment
- `npx convex deploy` — Deploy Convex to production

## Ports
- 5002: Main Express server
- 5173: Vite dev server
- 3505: Webhook server (server-hook)
- 5003: Bounce webhook server
- 3004/3002: Form server backend/frontend

## System Utilities (macOS/Darwin)
- `git`, `ls`, `find`, `grep`, `lsof -i :PORT` (check port usage)
