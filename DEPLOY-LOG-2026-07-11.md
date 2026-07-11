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
