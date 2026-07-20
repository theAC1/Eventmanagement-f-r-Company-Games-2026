---
name: Stale composite lib dist causes phantom export errors
description: "'no exported member' errors from @workspace libs usually mean stale dist .d.ts, not missing code"
---

Artifact tsconfigs use project references to `lib/*` composite packages that emit declaration-only output to `dist/`. Per-artifact `typecheck` scripts run `tsc -p --noEmit`, which resolves the referenced lib via its stale `dist/*.d.ts` — even though the package.json exports point at `src/`.

**Why:** Mobile typecheck reported dozens of "Module '@workspace/api-client-react' has no exported member" errors while `src/generated/api.ts` exported everything correctly; the dist was just out of date.

**How to apply:** When a `@workspace/*` import "has no exported member" but the source clearly exports it, run `tsc --build lib/<pkg>` (or root `pnpm run typecheck:libs`) first. Root `pnpm run typecheck` already does this. Per-artifact typecheck scripts should self-heal by prepending `tsc --build ../../lib/<pkg>` for their referenced libs (mobile does this now).
