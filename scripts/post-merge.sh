#!/bin/bash
set -e

# Allow lockfile to be updated after merges that change dependencies
pnpm install --no-frozen-lockfile

# Push any schema changes to the database (non-interactive; accept data loss in dev)
pnpm --filter @workspace/api-server exec prisma db push --accept-data-loss
