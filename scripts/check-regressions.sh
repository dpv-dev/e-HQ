#!/usr/bin/env bash
# ë • HQ — anti-regression gate (lot 7 of the incoherence audit).
# Locks in the audit fixes so the defect classes cannot silently return:
#   1. Known stub/fake values must never reappear in source.
#   2. Hardcoded colors in Svelte pages must not exceed the recorded baseline
#      (styling belongs to the var(--ehq-*) design tokens).
#   3. Raw <button> elements in apps/hq must not exceed the recorded baseline
#      (actions belong to the @ehq/ui Button; documented exceptions only).
# Baselines live in scripts/regression-baseline.json. Lowering a baseline after
# further cleanup is encouraged; raising one requires a deliberate, reviewed edit.
# Current baselines: 3 colors = the distribution statement A4 print document
# (standalone window without the token stylesheet); 11 raw buttons = documented
# exceptions (icon/multi-element controls the DS Button API does not cover).
# Uses plain /usr/bin/grep: interactive shells may alias grep/rg to other tools.
set -euo pipefail
cd "$(dirname "$0")/.."

BASELINE_FILE="scripts/regression-baseline.json"
SOURCE_DIRS=(apps/hq/src services/api/src packages/api-client/src packages/ui/src)
FAILED=0

# --- 1. Forbidden stub strings (audit lot 1/2 fake data) ---------------------
# Each of these shipped fake behavior once; none has a legitimate use in source.
FORBIDDEN_STRINGS=(
  "MU-PAY-PREVIEW"
  "MU-PAY-UPDATED"
  "bank_tx_preview"
  "track_alma"
  "preview-lock-token"
  "project_album_posters"
  "new.user@eeee.mu"
  "\"bank-connectors\""
  "cat_print"
)

for pattern in "${FORBIDDEN_STRINGS[@]}"; do
  if grep -rqF "$pattern" "${SOURCE_DIRS[@]}" 2>/dev/null; then
    echo "REGRESSION: forbidden stub string reappeared: $pattern"
    grep -rnF "$pattern" "${SOURCE_DIRS[@]}" 2>/dev/null | head -5
    FAILED=1
  fi
done

# --- 2 & 3. Counted baselines -------------------------------------------------
read_baseline() {
  python3 -c "import json,sys; print(json.load(open('$BASELINE_FILE'))['$1'])"
}

# grep exits 1 on zero matches; that is a success for these counters.
# [[:>:]] is BSD grep's word boundary: it keeps Svelte's {#each} blocks from
# being counted as hex colors (#eac...).
count_hardcoded_colors() {
  { grep -rhoE '#[0-9a-fA-F]{3,8}[[:>:]]|rgba?\(' --include='*.svelte' apps/hq/src 2>/dev/null || true; } | wc -l | tr -d ' '
}

count_raw_buttons() {
  { grep -rho '<button' --include='*.svelte' apps/hq/src 2>/dev/null || true; } | wc -l | tr -d ' '
}

check_counter() {
  local name="$1" current="$2" baseline="$3" hint="$4"
  if [ "$current" -gt "$baseline" ]; then
    echo "REGRESSION: $name went up: $current > baseline $baseline. $hint"
    FAILED=1
  fi
}

COLORS_NOW="$(count_hardcoded_colors)"
BUTTONS_NOW="$(count_raw_buttons)"
COLORS_BASE="$(read_baseline hardcodedColorsInSvelte)"
BUTTONS_BASE="$(read_baseline rawButtonsInAppsHq)"

check_counter "hardcoded colors in apps/hq *.svelte" "$COLORS_NOW" "$COLORS_BASE" \
  "Use var(--ehq-*) design tokens instead of literal colors."
check_counter "raw <button> elements in apps/hq" "$BUTTONS_NOW" "$BUTTONS_BASE" \
  "Use the @ehq/ui Button component; raw buttons are reserved for documented exceptions."

if [ "$FAILED" -ne 0 ]; then
  echo "check-regressions: FAILED"
  exit 1
fi

echo "check-regressions: ok (colors $COLORS_NOW/$COLORS_BASE, raw buttons $BUTTONS_NOW/$BUTTONS_BASE, stubs 0)"
