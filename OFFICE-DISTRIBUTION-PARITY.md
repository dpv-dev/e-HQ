# Office + Distribution parity — App vs WordPress

Audit date: 2026-07-12.

WordPress is a product/UX reference only. Runtime ownership remains Supabase
Postgres → Hono (`eof/v1`, `erh/v1`) → shared domain packages → HQ UI.

## Implemented in this parity pass

| Surface | WordPress reference | App implementation |
| --- | --- | --- |
| Shared module shell | Compact module rail plus horizontal section navigation | Restored for Office and Distribution with the canonical `#FFB800`, Inter, Space Mono, and shared UI tokens. |
| Office dashboard KPIs | Ledger income, ledger expense, net profit, validated transactions | Added explicit API fields backed by `domain-office` P&L, plus pending and unreconciled counts. |
| Office dashboard hero | Light overview/date surface | Reproduced with shared tokens and the existing period control. |
| Distribution workflow hero | Upload → exceptions → approval | Reproduced as import → exception resolution → allocation/validation. |
| Distribution primary KPIs | Imported revenue by currency, paid royalties, open recoupables, FX | Added to `GET /erh/v1/dashboard`; all money aggregation uses the scale-10 BigInt kernel and stays separated by currency. |
| Distribution readiness | Mapping, catalog, contracts, expenses, allocations, suspense | Added as backend-owned counts from normalized earnings, catalog, contracts/cost terms, and suspense read models. |
| Distribution coverage | Contract/catalog coverage | Derived from releases whose track ISRC is represented by a matched normalized earning. |

## Live data findings

- Distribution imported revenue matches the WordPress reference:
  `EUR 36,747.38` and `USD 9,358.63`.
- Distribution open recoupable balances expose `EUR 2,533.34` from Supabase.
- Current FX reads expose EUR/MUR `55.09`, GBP/MUR `63.83`, and USD/MUR
  `47.62`; values come from the new runtime and can legitimately differ from a
  stale WordPress snapshot.
- Office WordPress shows 523 validated 2026 ledger rows. The new Office runtime
  currently returns no validated 2026 P&L rows for the selected workspace/range.
  The UI now reports that state honestly; copying WordPress numbers into the UI
  would create a second source of truth.

## Intentionally still hidden

| Surface | Why it is not exposed yet | Required implementation |
| --- | --- | --- |
| Wave invoices | The existing App lane was a redirect-only placeholder and no Supabase/Hono invoice model exists. | Contract-first invoice schema, provider credential/config model, idempotent sync, audit events, list/detail API, and UI. |
| Generic invoice PDF import | Existing App PDF support is a bank-statement parser, not the WordPress invoice-document workflow. | Immutable document/import batch, extraction output, detection/parsing, audited corrections, reversible commit, and retention policy. |

These entries remain hidden until the complete backend path exists; the App must
not call WordPress to simulate parity.
