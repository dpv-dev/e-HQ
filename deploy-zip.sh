#!/usr/bin/env bash
# ë • HQ — package the built artifacts into the two upload zips, deterministically.
# Run AFTER ./deploy-build.sh. Zips the *contents* of each deploy folder (flat), so
# unzipping on the host puts server.bundle.js / index.html at the app root.
#
# Produces (gitignored, no secrets):
#   app-eeee-api-hostinger.zip  <- services/api/deploy/   (Hostinger Node slot; entry server.bundle.js)
#   app-eeee-frontend.zip       <- apps/hq/dist/          (static SPA)
set -euo pipefail
cd "$(dirname "$0")"

API_DIR="services/api/deploy"
FRONT_DIR="apps/hq/dist"
API_ZIP="app-eeee-api-hostinger.zip"
FRONT_ZIP="app-eeee-frontend.zip"

# --- preconditions: build must have run ---
[ -f "$API_DIR/server.bundle.js" ] || { echo "ERROR: $API_DIR/server.bundle.js missing — run ./deploy-build.sh first"; exit 1; }
[ -f "$API_DIR/scripts/refresh-fx.mjs" ] || { echo "ERROR: $API_DIR/scripts/refresh-fx.mjs missing — run ./deploy-build.sh first"; exit 1; }
[ -f "$FRONT_DIR/index.html" ] || { echo "ERROR: $FRONT_DIR/index.html missing — run ./deploy-build.sh first"; exit 1; }

# --- secret guard: never ship .env or real secret values ---
echo "==> Secret guard"
if find "$API_DIR" "$FRONT_DIR" -name "*.env" -o -name ".env*" | grep -q .; then
  echo "ERROR: an .env file is inside an artifact folder — refusing to zip."; exit 1
fi
# sb_secret_ is the SECRET Supabase key; the publishable key (sb_publishable_) is fine.
if grep -rqE "sb_secret_[A-Za-z0-9]" "$API_DIR" "$FRONT_DIR" 2>/dev/null; then
  echo "ERROR: a sb_secret_ key value is inside an artifact folder — refusing to zip."; exit 1
fi
echo "    clean (no .env, no sb_secret_)"

# --- zip contents (flat), excluding macOS cruft ---
echo "==> API zip   -> $API_ZIP"
rm -f "$API_ZIP"
( cd "$API_DIR" && zip -rq "$OLDPWD/$API_ZIP" . -x '*.DS_Store' '__MACOSX/*' )

echo "==> Front zip -> $FRONT_ZIP"
rm -f "$FRONT_ZIP"
( cd "$FRONT_DIR" && zip -rq "$OLDPWD/$FRONT_ZIP" . -x '*.DS_Store' '__MACOSX/*' )

echo
echo "Top-level of $API_ZIP:"
unzip -Z1 "$API_ZIP" | grep -vE '/.+' | sed 's/^/    /'
echo "Top-level of $FRONT_ZIP:"
unzip -Z1 "$FRONT_ZIP" | grep -vE '/.+' | sed 's/^/    /'
echo
echo "Sizes:"; ls -lh "$API_ZIP" "$FRONT_ZIP" | awk '{print "    "$5"  "$9}'
echo "Done. Upload these two on the host (see DEPLOYMENT.md)."
