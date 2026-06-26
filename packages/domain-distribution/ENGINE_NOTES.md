# Distribution Allocation Engine Notes

This package computes ERH allocation and recoupment plans from local inputs. It
does not connect to a database; the API layer will later persist the returned
plan atomically.

Flagged behaviours intentionally preserved from the PHP write path:

1. Cross-currency recoupment is gated but not performed. If a contract has open
   recoupable costs in a foreign currency, the engine requires an FX rate for
   the earning reference date, but it only applies recoupment to same-currency
   cost terms. True cross-currency advance recovery changes recovered money and
   remains a deferred domain decision.
2. Negative earning shares on recoupable contracts follow the PHP formula:
   `min(recoupable_remaining, gross_share)`. That can produce a negative
   recoupment amount and zero net payable for refund-like rows. The behaviour is
   pinned by a test and marked for domain review; negative carry-forward belongs
   to F4.

Other invariants:

- Royalty percentages are scale-6 exact strings and must sum to exactly
  `100.000000`; there is no tolerance.
- Gross splits use a remainder-last strategy at ERH scale 10: all non-last
  shares truncate through `erhMoney`, and the last share absorbs the remainder.
- Recoupment distribution is FIFO by `expense_date`, then cost term id.

## Statement And Carry-Forward Notes

F4 ports statement generation and the negative carry-forward ledger as pure
plans.

1. Carry-forward uses the PHP invariant: `available = opening + period_net`,
   `amount_due = max(available, 0)`, and `closing = min(available, 0)`. Closing
   is therefore always zero or negative; positive surplus is payable and is not
   carried.
2. Voiding is append-only. The void plan appends a compensating
   `void_reversal` ledger row and marks the statement `void`; it does not delete
   the original statement ledger row.
3. Float leak fixed: PHP cast statement group totals to float before
   subtracting payments. The TypeScript port keeps group totals in `erhMoney`
   scale-10 units, so group subtraction is exact and cannot drift.
