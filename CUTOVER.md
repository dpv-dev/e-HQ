# E4 cutover plan

This plan is manual and David-only. Codex must not execute these steps.

## Pre-cut checklist

Parity green, secrets rotated, Supabase backup taken.
For host deployment and shadow bootstrap steps based on the self-contained bundle, follow `DEPLOY.md`.

## Inputs David keeps outside the repo

- `DATABASE_URL`: Supabase direct or session-pooler URL for the Hono API.
- `HOST` / `PORT`: Hostinger Node slot binding values.
- `WP_BASE_URL`, `WP_APP_USER`, `WP_APP_PASSWORD`: kept only until parity is
  complete, then removed after cutover.

## Shadow deploy before cut

1. Build locally:

   ```bash
   corepack pnpm --filter @ehq/api build
   corepack pnpm --filter @ehq/api build:deploy
   ```

2. Upload only the deployable API artifact and runtime package metadata to the
   Hostinger Node shadow slot:

   ```text
   services/api/deploy/
   ```

3. Configure the shadow slot env in Hostinger:

   ```text
   DATABASE_URL=<David-only Supabase URL>
   HOST=0.0.0.0
   PORT=<shadow port>
   NODE_ENV=production
   ```

4. Start command:

   ```bash
   node services/api/deploy/server.bundle.js
   ```

5. Health check the shadow URL:

   ```bash
   curl -fsS "$HONO_SHADOW_URL/healthz"
   curl -fsS "$HONO_SHADOW_URL/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02"
   ```

6. Run read-only parity from David's machine:

   ```bash
   HONO_SHADOW_URL="$HONO_SHADOW_URL" \
   WP_BASE_URL="$WP_BASE_URL" \
   WP_APP_USER="$WP_APP_USER" \
   WP_APP_PASSWORD="$WP_APP_PASSWORD" \
   corepack pnpm --filter @ehq/api phase-e:parity
   ```

7. Review `reports/phaseE-parity.md`. Only the documented `BUG-M1` divergence is
   allowed before cutover.

## Cutover

1. Leave WordPress running and reachable.
2. Confirm the Hono shadow slot health check is green.
3. Point the production app route/domain to the Hono Node slot in Hostinger.
4. Verify exact production routes, not only the homepage:

   ```bash
   curl -fsS "$PROD_URL/healthz"
   curl -fsS "$PROD_URL/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02"
   curl -fsS "$PROD_URL/erh/v1/statements?workspaceId=workspace_1&period=2026-04&limit=5"
   ```

5. Keep WordPress available read-only as rollback safety during the observation
   window.

## Rollback

1. Re-point the production route/domain back to the WordPress slot.
2. Verify WordPress REST surfaces:

   ```bash
   curl -fsS "$WP_BASE_URL/wp-json/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02"
   curl -fsS "$WP_BASE_URL/wp-json/erh/v1/dashboard?workspaceId=workspace_1&period=2026-04"
   ```

3. Leave Hono shadow running for diagnosis; do not mutate data as part of
   rollback.

## Post-cut cleanup

After the observation window is green:

1. Remove `WP_BASE_URL`, `WP_APP_USER`, and `WP_APP_PASSWORD` from the Hono
   production env.
2. Revoke the WordPress application password used for parity.
3. Keep a final Supabase backup and the green `reports/phaseE-parity.md`.
4. Schedule WordPress decommissioning separately; do not delete it as part of
   the initial cutover.
