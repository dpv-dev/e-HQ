# Hostinger Shadow Deploy (E2-BUNDLE)

This runbook is for David to stage a non-production shadow of the Hono API.  
WordPress remains live; no DNS/domain change is done at this stage.

## Scope

- Deploy target: Hostinger Node shadow slot (non-prod path or subdomain).
- Artifact: `services/api/deploy/` only.
- No WordPress cutover is performed by this step.

## Build and package (local, offline)

1. Build the API dist (typecheck + transpile):

   ```bash
   corepack pnpm --filter @ehq/api build
   ```

2. Build the single-file shadow bundle:

   ```bash
   corepack pnpm --filter @ehq/api build:deploy
   ```

3. Confirm bundle exists and is populated:

   ```bash
   test -s services/api/deploy/server.bundle.js
   ```

## Hostinger shadow upload

1. Upload the following to the shadow slot directory:
   - `services/api/deploy/`
2. Do not upload the full monorepo.
3. On the slot, run from the uploaded folder:

   ```bash
   node -v  # should be Node >= 18
   npm install --omit=dev
   ```

4. Set environment variables in the slot:
   - `DATABASE_URL=<rotated Supabase direct/pooler URL for the slot>`
   - `HOST=0.0.0.0`
   - `PORT=<slot port>`
   - Do not set `WP_BASE_URL`, `WP_APP_USER`, `WP_APP_PASSWORD` on this slot.

## Start and health-check

1. Start command:

   ```bash
   node server.bundle.js
   ```

   (with the above environment variables set in the slot)

2. Health check:

   ```bash
   curl -fsS "$SHADOW_URL/healthz"
   ```

   Expected: HTTP 200 JSON with `"status":"ok"`.

## Parity smoke (read-only)

When useful, David can run the local scripted parity flow from the repo against the shadow:

```bash
HONO_SHADOW_URL="$SHADOW_URL" corepack pnpm --filter @ehq/api phase-e:parity
```

(The parity script itself remains read-only against both Hono and WordPress.)

## Rollback from shadow (no cutover impact)

1. Stop the shadow Node process.
2. Keep WordPress untouched and fully operational.
3. Remove/revert any shadow route binding; do not alter production WordPress routes.

## Cutover

Cutover is a separate manual step documented in `CUTOVER.md`:
1. Confirm shadow parity and gate checks.
2. Switch Hostinger production route/domain to the Hono app when approved.
3. Keep rollback plan ready via `CUTOVER.md`.
