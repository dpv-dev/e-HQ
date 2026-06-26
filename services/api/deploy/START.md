# EHQ Hono Shadow Start

This folder contains a self-contained deployable artifact for Hostinger Node shadow.

## Requirements

- `DATABASE_URL` must be provided by the runtime environment.
- `HOST` and `PORT` are optional:
  - `HOST` default is `0.0.0.0`
  - `PORT` default is `8787`

## Run locally

From this directory (or by pointing the process cwd to this folder):

```bash
HOST=0.0.0.0 PORT=8787 DATABASE_URL="postgres://..." node server.bundle.js
```

Health check:

```bash
curl -fsS http://127.0.0.1:8787/healthz
```

## Notes

- The `server.bundle.js` file is produced by `pnpm --filter @ehq/api build:deploy`.
- `DATABASE_URL` is intentionally not embedded in the artifact.
- Install runtime deps on the slot before start (pg-only runtime external):

  ```bash
  cd services/api/deploy
  npm install --omit=dev
  npm start
  ```

- If needed, the optional `.env` file can be used for local runs from the repository
  root. The runtime slot should rely on injected environment variables instead.
