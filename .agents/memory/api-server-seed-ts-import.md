---
name: api-server shares TS logic with plain-node scripts
description: How prisma scripts run outside the esbuild bundle can still share typed src/ logic.
---

The esbuild build only bundles `src/index.ts`; scripts under `prisma/` (e.g.
`db:seed` → `node prisma/seed.mjs`) run with no build step. To avoid duplicating
logic between such a script and the bundled server, keep the logic in one typed
module under `src/lib/` and import it from both.

**Why:** Node 24 strips types and can import a `.ts` module directly from a
`.mjs` file, so a single `src/lib/*.ts` source serves both the CLI script and the
bundled API route — no duplicated seed/business logic that can drift apart.

**How to apply:** Put shared logic in `src/lib/`. Import it from `prisma/*.mjs`
via a relative `.ts` specifier. Caveat: tsconfig `include` is `["src"]`, so
`prisma/*.mjs` is NOT typechecked — keep those wrappers thin. If a future Node
drops type-stripping, add a dedicated build entry for the script or convert the
shared module to plain JS.
