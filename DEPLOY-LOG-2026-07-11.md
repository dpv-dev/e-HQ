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
