---
name: api-server seed shares TS logic
description: How the CLI seed and the API endpoint share one seed implementation.
---

The demo/rehearsal seed logic lives in `artifacts/api-server/src/lib/seed-demo.ts`
(exports `seedDemo(prisma, startedById?)` and `hasHotGameday(prisma)`).

- The API route `POST /api/gameday/seed-demo` (ADMIN-only, refuses when a HOT
  gameday is active) imports it directly.
- The CLI `prisma/seed.mjs` (run by `db:seed`) also imports it via
  `import { seedDemo } from "../src/lib/seed-demo.ts"`.

**Why:** `db:seed` runs `node prisma/seed.mjs` with no build step, and esbuild
only bundles `src/index.ts`. Node 24 strips types and can import a `.ts` module
from a `.mjs` file, so a single shared TS source works for both without a build.

**How to apply:** Don't duplicate seed data into seed.mjs. If Node ever loses
type-stripping, either add a build entry for the seed or convert seed-demo to
plain JS. Note tsconfig `include` is `["src"]`, so `prisma/*.mjs` is not typechecked.
