# Parser Migration Design (Frontend -> Backend Authority)

Last updated: 2026-07-11
Status: in progress (Stage B slice landed)

## 1) Goal
Move statement/import parsing authority to backend APIs so frontend no longer owns business parsing logic in production.

## 2) Current State
Current frontend parser ownership:
- apps/hq/src/app/bank-parser.ts
- apps/hq/src/app/pdf-extract.ts

Current behavior:
- Frontend reads file text (and PDF extraction in browser), parses rows client-side, then sends normalized row payload to API preview/confirm endpoints.
- New dual path exists: when `VITE_OFFICE_BACKEND_PARSER` is enabled, frontend sends extracted text to `eof/v1/bank-import/parse-preview` and uses API-normalized rows for preview/confirm.

Important clarification:
- This is local TypeScript code, not a runtime link to the old WordPress engine.
- Comments describe historical origin, but execution is local in this repo.

## 3) Target State
Backend ownership model:
- Frontend uploads file (or raw text) to API parse-preview endpoint.
- API parser returns normalized rows plus warnings/rejections.
- API confirm endpoint imports from server-side validated parse output.
- Frontend parser path is fallback-only during migration, then removed/disabled.

## 4) Proposed Contracts

### 4.1 Parse preview endpoint
Method: POST
Path: eof/v1/bank-import/parse-preview (or compatible namespace route)
Input:
- workspaceId
- fileName
- sourceHint (optional)
- contentText (raw CSV text or extracted PDF text)
Output:
- detected source/currency
- parsedRowCount
- normalized rows (header-keyed records ready for existing preview endpoint)
- parsingNotes

### 4.2 Parse confirm endpoint
Method: POST
Path: eof/v1/bank-import/parse-confirm
Input:
- parseSessionId
- selected row ids
- idempotency key
Output:
- mutation receipt
- imported counts
- batch id

## 5) Migration Stages

### Stage A - Backend parser parity harness
- Build backend parser module with fixture-driven tests.
- Reuse golden fixtures from current frontend parser outputs.
Status: started (backend parser module in place; fixture diff harness still pending).

### Stage B - Dual path (hidden switch)
- Keep current frontend parse path.
- Add feature flag: useBackendParser.
- When enabled, frontend uses new parse-preview endpoint.
Status: shipped (hidden flag `VITE_OFFICE_BACKEND_PARSER`, fallback preserved).

### Stage C - Parity validation
- Run same sample statements through both paths.
- Diff accepted/rejected rows and key fields.
- Close parity gaps before default flip.
Status: started.
Completed in this slice:
- Added automated parity harness in services/api/test/office-bank-parser-parity.test.ts.
- Baseline parity now validated for CSV, MCB extracted text, and SBI extracted text normalization.
Remaining:
- Extend from synthetic baseline samples to production-like fixture corpus and attach machine-readable diff artifacts in CI.

### Stage D - Default flip
- Enable backend parser path by default in production.
- Keep frontend path behind emergency fallback flag for one stabilization window.

### Stage E - Cleanup
- Remove production use of frontend parser.
- Remove dead code and docs references once fallback window closes.

## 6) Risks and Controls
Risk: parser output drift between frontend and backend.
Control: golden fixture suite + explicit diff report in CI.

Risk: larger files/timeouts in API parser endpoint.
Control: streaming upload limits, async processing guardrails, request size controls.

Risk: import regressions after flip.
Control: temporary fallback flag + deploy smoke checks on parse-preview and confirm.

## 7) Acceptance Criteria for Phase 3 completion
1. Backend parse-preview and parse-confirm are primary production path.
2. Frontend parser path is disabled or removed for production usage.
3. Fixture parity suite is green and part of CI.
4. Import smoke tests pass on production-like samples.
