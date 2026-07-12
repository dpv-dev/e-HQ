# Deploy Log - 2026-07-11

## Build and gate
- Ran ./deploy-build.sh
- Result: success
- Key results:
  - API tests: 81/81 pass
  - HQ svelte-check: 0 error / 0 warning
  - HQ build: pass
  - Regression gate: pass
  - SQL column check: pass
  - Artifacts generated:
    - app-eeee-api-hostinger.zip
    - app-eeee-frontend.zip

## Production rollout
- Uploaded artifacts via scp to ~/ehq-deploy-upload/
- Unzipped API artifact to ~/domains/api.eeee.mu/nodejs/
- Unzipped frontend artifact to ~/domains/app.eeee.mu/public_html/
- Restarted API via touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt

## Smoke verification
- Initial API health check: 503 (startup warm-up)
- Follow-up smoke checks: all pass
  - https://api.eeee.mu/healthz -> 200
  - https://app.eeee.mu/ -> 200
  - https://app.eeee.mu/console/office/bank -> 200
  - https://app.eeee.mu/console/distribution/settings -> 200
  - https://app.eeee.mu/console/command-center/settings -> 200
- Automated script:
  - corepack pnpm smoke:critical -> PASS

## Notes
- 503 during first check is expected during startup warm-up window.
- Deployment followed DEPLOY.md and DEPLOYMENT.md canonical path.

## Completion Cycle - 2026-07-11 (Phase 7/8 closure)

### Ordered gate sequence
- Ran `corepack pnpm --filter @ehq/api-client check` -> pass
- Ran `corepack pnpm --filter @ehq/api check` -> pass
- Ran `corepack pnpm --filter @ehq/hq check` -> pass (`svelte-check` 0 error / 0 warning)
- Ran `corepack pnpm smoke:critical` -> PASS
- Ran `./deploy-build.sh` -> success
  - API tests: 89/89 pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass

### Rollout
- Uploaded fresh artifacts (`app-eeee-api-hostinger.zip`, `app-eeee-frontend.zip`) to `~/ehq-deploy-upload/`
- Deployed API to `~/domains/api.eeee.mu/nodejs/`
- Deployed frontend to `~/domains/app.eeee.mu/public_html/`
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`

### Verification
- Warm-up window observed as expected: `/healthz` returned `503 {"status":"starting"}` before recovery.
- API health recovered to `200` with DB status `ok`.
- Post-deploy `corepack pnpm smoke:critical` -> PASS
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200
- Targeted auth guard checks:
  - `https://api.eeee.mu/eof/v1/status?workspaceId=eeee-mu` -> 401
  - `https://api.eeee.mu/cc/v1/status?workspaceId=eeee-mu` -> 401

## Master Plan Completion Cycle - 2026-07-11 (Phase 3 Stage E)

### Scope
- Completed parser migration cleanup by removing runtime frontend statement parser fallback from Office import flow.
- Release commit: `b1200b9`.

### Ordered gate sequence
- Ran `./deploy-build.sh` -> success
  - API tests: 89/89 pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass
- Ran `corepack pnpm --filter @ehq/api parser:parity-report` -> `ok (10 cases)`

### Rollout
- Uploaded fresh artifacts (`app-eeee-api-hostinger.zip`, `app-eeee-frontend.zip`) to `~/ehq-deploy-upload/`
- Deployed API + frontend artifacts to Hostinger targets
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`

### Verification
- Warm-up observed (`/healthz` returned `503 {"status":"starting"}` across initial retries), then recovered during smoke run.
- Post-deploy `corepack pnpm smoke:critical` -> PASS
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200

## Financial Correctness Hardening Cycle - 2026-07-11 (Direction + EUR FX)

### Scope
- Deployed commit `4d5697d` (EUR reconciliation-create currency normalization).
- Deployed commit `2d264ce` (strict debit/credit-only direction ingestion for office bank import parsing).

### Ordered validation sequence
- Ran `corepack pnpm --filter @ehq/api test` -> `91/91` pass (after EUR + direction hardening).
- Ran `./deploy-build.sh` -> success
  - API typecheck/build: pass
  - API tests: 91/91 pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass
- Pre-deploy `corepack pnpm smoke:critical`
  - first run: health `503` (warm-up)
  - immediate rerun: PASS

### Rollout
- Uploaded `app-eeee-api-hostinger.zip` + `app-eeee-frontend.zip` to `~/ehq-deploy-upload/` via `scp`.
- Unzipped API artifact to `~/domains/api.eeee.mu/nodejs/`.
- Unzipped frontend artifact to `~/domains/app.eeee.mu/public_html/`.
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`.

### Post-deploy verification
- Initial post-restart smoke observed expected startup `503` on `/healthz`.
- Direct check then returned `200` with DB status `ok` on `https://api.eeee.mu/healthz`.
- Final post-deploy `corepack pnpm smoke:critical` -> PASS
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200

### Notes
- Warm-up 503 behavior remains consistent with startup-loading design; recovery observed without intervention beyond restart wait window.

## Release Closure Cycle - 2026-07-12 (Phase 0 -> 11 execution)

### Scope
- Release head: `4515b53`
- Delta included in release: UI count-up animation for KPI/stat cards + tests.

### Ordered validation sequence
- Ran `./deploy-build.sh` -> success
  - API tests: 98/98 pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass
- Ran `corepack pnpm smoke:critical` (pre-deploy) -> PASS
- Ran targeted auth guard checks (unauth expected):
  - `/eof/v1/status?workspaceId=eeee-mu` -> 401
  - `/cc/v1/status?workspaceId=eeee-mu` -> 401
  - `/auth/me` -> 401

### Runtime observability snapshot
- Supabase advisors fetched (`security`, `performance`): informational findings in current snapshot.
- Supabase postgres logs snapshot: routine LOG-level entries in sampled output.
- Supabase auth logs include recurring `400: Invalid Refresh Token: Refresh Token Not Found` events (tracked as non-blocking client/session hygiene item).

### Rollout
- Uploaded `app-eeee-api-hostinger.zip` + `app-eeee-frontend.zip` to `~/ehq-deploy-upload/` via `scp`.
- Unzipped API artifact to `~/domains/api.eeee.mu/nodejs/`.
- Unzipped frontend artifact to `~/domains/app.eeee.mu/public_html/`.
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`.

### Post-deploy verification
- Initial health checks remained in startup window: `/healthz` -> `503 {"status":"starting"}`.
- Follow-up direct check: `curl -i https://api.eeee.mu/healthz` -> 200 with DB status `ok`.
- Final post-warmup `corepack pnpm smoke:critical` -> PASS
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200
- Targeted auth guard checks after deploy:
  - `https://api.eeee.mu/eof/v1/status?workspaceId=eeee-mu` -> 401
  - `https://api.eeee.mu/cc/v1/status?workspaceId=eeee-mu` -> 401

## Count-up Showcase + CORS Stabilization - 2026-07-12

### Scope
- Include remaining count-up design showcase artifact in git history and remove live preflight blockers observed during connected Office verification.

### Commits
- `afe14c2` — `feat(ui): add animated Office dashboard showcase`
- `5cc869c` — `fix(api): allow Cache-Control in CORS preflight headers`
- `30cceb1` — `fix(api): allow Pragma in CORS preflight headers`

### Ordered validation sequence
- Ran explicit package checks requested for the count-up lot:
  - `corepack pnpm --filter @ehq/ui check` -> pass
  - `corepack pnpm --filter @ehq/hq check` -> pass
  - `corepack pnpm --filter @ehq/hq build` -> pass
  - `corepack pnpm --filter @ehq/hq test` -> pass (38/38)
- Ran canonical `./deploy-build.sh` after hotfixes -> success
  - API tests: 98/98 pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass

### Runtime issue and resolution
- Observed connected browser failures on Office dashboard:
  - preflight blocked for request header `cache-control`
  - after first fix, preflight blocked for request header `pragma`
- Resolved by expanding CORS `allowHeaders` in both:
  - startup 503 stub (`services/api/src/server.ts`)
  - main Hono cors middleware (`services/api/src/index.ts`)

### Rollout
- Uploaded rebuilt `app-eeee-api-hostinger.zip` + `app-eeee-frontend.zip` via `scp` to `~/ehq-deploy-upload/`.
- Unzipped artifacts into Hostinger API/frontend roots.
- Restarted API (`touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`).

### Post-deploy verification
- Warm-up window observed (`503 {"status":"starting"}`), then `healthz` recovered to `200`.
- `corepack pnpm smoke:critical` -> PASS.
- Auth guard checks preserved:
  - `/eof/v1/status?workspaceId=eeee-mu` -> 401
  - `/cc/v1/status?workspaceId=eeee-mu` -> 401
  - `/auth/me` -> 401

### Connected UI verification (authenticated)
- Session confirmed as `David administrator`.
- Office dashboard KPI data loaded successfully after CORS fixes.
- Count-up observed during period changes with stable landing values:
  - final stable example: `Receivables 2,403,889.38 Rs`
  - final stable example: `Payables 14,033,987.78 Rs`
- Non-numeric ratio check: `4/4` remained exact and stable over repeated samples (no animation drift).

## Office Workspace Scope Fix Deployment - 2026-07-12

### Scope
- Release commit: `152eb4f` (`fix(api): scope office read routes by workspace`).
- Objective: enforce workspace-bound Office read data to eliminate P&L/dashboard cross-workspace leakage.

### Ordered validation sequence
- Ran `./deploy-build.sh` -> success
  - API tests: `99/99` pass
  - HQ `svelte-check`/build: pass
  - Regression gate: pass
  - SQL column check: pass
  - Artifacts regenerated: `app-eeee-api-hostinger.zip`, `app-eeee-frontend.zip`

### Rollout
- Uploaded fresh artifacts to `~/ehq-deploy-upload/` via `scp`.
- Deployed API artifact to `~/domains/api.eeee.mu/nodejs/`.
- Deployed frontend artifact to `~/domains/app.eeee.mu/public_html/`.
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`.

### Post-deploy verification
- Immediate health check: startup warm-up observed (`503 {"status":"starting"}`).
- Follow-up direct health check: `https://api.eeee.mu/healthz` -> `200` with DB status `ok`.
- First post-restart smoke run still saw transient health jitter (`503`) while app routes remained `200`.
- Final rerun `corepack pnpm smoke:critical` -> PASS:
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200

### Connected visual verification
- Opened `https://app.eeee.mu/console/office/pnl` in authenticated session.
- Confirmed route renders and Office P&L surfaces load under the deployed build.

## Office Scoped Reads Regression Hardening - 2026-07-12

### Scope
- Release commit: `2ba08a6` (`fix(api): keep office reference entities in scoped reads`).
- Objective: keep financial data strictly workspace-scoped while preserving reference visibility (`projects`, `partners`) for Office routes.

### Ordered validation sequence
- Ran focused API regressions after patch -> pass (including new scoped-reference coverage).
- Ran canonical `./deploy-build.sh` -> success:
  - API tests: `100/100` pass
  - HQ check/build: pass
  - Regression gate: pass
  - SQL column check: pass
  - Artifacts regenerated: `app-eeee-api-hostinger.zip`, `app-eeee-frontend.zip`

### Rollout
- Uploaded artifacts to `~/ehq-deploy-upload/` via `scp`.
- Unzipped API bundle to `~/domains/api.eeee.mu/nodejs/`.
- Unzipped frontend bundle to `~/domains/app.eeee.mu/public_html/`.
- Restarted API via `touch ~/domains/api.eeee.mu/nodejs/tmp/restart.txt`.

### Post-deploy verification
- Direct health check: `https://api.eeee.mu/healthz` -> `200` with DB status `ok`.
- `corepack pnpm smoke:critical` -> PASS:
  - `https://api.eeee.mu/healthz` -> 200
  - `https://app.eeee.mu/` -> 200
  - `https://app.eeee.mu/console/office/bank` -> 200
  - `https://app.eeee.mu/console/distribution/settings` -> 200
  - `https://app.eeee.mu/console/command-center/settings` -> 200
- Additional API sanity checks confirmed Office endpoints return expected auth guards (401 unauth, not startup 503):
  - `/eof/v1/status?workspaceId=eeee-mu`
  - `/eof/v1/pl/global?workspaceId=eeee-mu&period=2026-07`

### Connected visual note
- Opening `/console/office/pnl` immediately after restart can still show transient console `503` fetch errors during startup retry windows.
- Backend was healthy (`/healthz` 200) and critical smoke remained fully green after warm-up.
