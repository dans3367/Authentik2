# Task Completion Checklist

When a coding task is completed, consider:

1. **Type check**: Run `npm run check` (tsc) to verify no type errors
2. **Schema changes**: If `shared/schema.ts` was modified, run `npx drizzle-kit generate` to create a migration, then `npm run db:push` to apply
3. **Test**: No formal test runner configured; manual testing via browser or shell scripts in `tests/`
4. **Build**: Run `npm run build` if verifying production build
5. **Trigger.dev**: If trigger tasks changed, restart `npm run dev:trigger`
6. **Convex**: If convex functions changed, `npx convex dev` auto-deploys in dev mode
