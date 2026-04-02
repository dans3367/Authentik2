# Code Style & Conventions

## General
- TypeScript strict mode, ESM (`"type": "module"`)
- Module resolution: bundler
- No explicit formatting/linting tool configured (no eslint/prettier in package.json)

## Backend (server/)
- Express routes organized by domain in `server/routes/` (e.g. `newsletterRoutes.ts`, `userRoutes.ts`)
- Routes registered centrally in `server/routes.ts`
- Middleware in `server/middleware/`
- Drizzle ORM for DB access (`server/db.ts` for connection)
- Zod for request validation
- Pino for logging (`server/logger.ts`)

## Frontend (client/src/)
- React 18 with function components and hooks
- shadcn/ui component library (components in `client/src/components/ui/`)
- wouter for routing (not react-router)
- React Query for data fetching (`@tanstack/react-query`)
- Redux Toolkit + redux-persist for global state
- react-hook-form + zod for forms
- TailwindCSS 3 for styling
- Path alias: `@/` maps to `client/src/`

## Schema
- Single source of truth: `shared/schema.ts` (Drizzle PostgreSQL schema)
- Migrations in `migrations/` directory

## Background Jobs
- Trigger.dev v4 tasks in `src/trigger/`
- Config: `trigger.config.ts` at project root

## Naming
- Files: kebab-case for routes/components, camelCase for utilities
- React components: PascalCase
- Variables/functions: camelCase
- DB tables/columns: snake_case (Drizzle schema)
