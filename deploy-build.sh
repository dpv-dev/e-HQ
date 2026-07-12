#!/usr/bin/env bash
# ë • HQ — build all deployable artifacts (no production access, no secrets).
# Produces: services/api/deploy/server.bundle.js  and  apps/hq/dist/
# Safe to run anywhere; does NOT touch the database or any live host.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> API: typecheck + transpile"
corepack pnpm --filter @ehq/api build

echo "==> API: single-file deploy bundle (esbuild, pg external)"
corepack pnpm --filter @ehq/api build:deploy

echo "==> API: ship the daily FX refresh script alongside the bundle"
mkdir -p services/api/deploy/scripts
cp services/api/scripts/refresh-fx.mjs services/api/deploy/scripts/refresh-fx.mjs

echo "==> API: ship the Hostinger runtime preload helper alongside the bundle"
cp services/api/scripts/normalize-database-url.cjs services/api/deploy/normalize-database-url.cjs

echo "==> API: gate checks"
corepack pnpm --filter @ehq/api check
corepack pnpm --filter @ehq/api test

echo "==> Frontend (apps/hq): typecheck + build"
corepack pnpm --filter @ehq/hq check
corepack pnpm --filter @ehq/hq build
corepack pnpm perf:frontend

echo "==> Anti-regression gate (audit lock-in)"
bash scripts/check-regressions.sh

echo "==> SQL column completeness check"
node scripts/check-sql-columns.mjs

echo "==> Package upload zips (deterministic, secret-guarded)"
bash deploy-zip.sh

echo
echo "Artifacts ready:"
echo "  API   -> services/api/deploy/   (or app-eeee-api-hostinger.zip; entry: server.bundle.js)"
echo "  Front -> apps/hq/dist/          (or app-eeee-frontend.zip; static SPA, /index.html fallback)"
echo
echo "Next (production, run with Codex): see DEPLOYMENT.md"
