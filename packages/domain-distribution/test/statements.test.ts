import assert from "node:assert/strict";
import test from "node:test";
import {
  type PayeeBalanceLedgerInput,
  type StatementAllocationInput,
  buildStatementPlan,
  buildStatementsForPeriod,
  buildVoidPlan,
  computeCarry,
  computeStatementBalance,
  computeStatementGroupTotals
} from "../src/statements.ts";
import { createDistributionStatementDraft } from "../src/index.ts";
import {
  createCurrencyCode,
  parseDecimalToMicroUnits
} from "@ehq/domain-finance";

const period = {
  start: "2026-01-01",
  end: "2026-01-31"
};

const payee = {
  id: "payee_a"
};

test("distribution statement draft is a stable domain value", () => {
  const draft = createDistributionStatementDraft({
    payeeId: "payee_a",
    periodStart: period.start,
    periodEnd: period.end,
    currencyTotal: parseDecimalToMicroUnits("125.000000", createCurrencyCode("USD")),
    allocationLines: [],
    openExpenses: []
  });

  assert.equal(draft.payeeId, "payee_a");
  assert.equal(draft.allocationLines.length, 0);
  assert.equal(draft.openExpenses.length, 0);
});

const allocations: readonly StatementAllocationInput[] = [
  {
    id: "allocation_1",
    payeeId: "payee_a",
    trackId: "track_1",
    currency: "USD",
    grossShare: "100.0000000000",
    recoupmentApplied: "25.0000000000",
    netPayable: "75.0000000000",
    quantity: "10.000000"
  },
  {
    id: "allocation_2",
    payeeId: "payee_a",
    trackId: "track_2",
    currency: "USD",
    grossShare: "50.0000000000",
    recoupmentApplied: "0.0000000000",
    netPayable: "50.0000000000",
    quantity: "5.500000"
  }
];

test("computeCarry covers positive, negative, reducing deficit, and over-covering deficit cases", () => {
  assert.deepEqual(computeCarry("0.0000000000", "100.0000000000"), {
    opening: "0.0000000000",
    periodNet: "100.0000000000",
    available: "100.0000000000",
    amountDue: "100.0000000000",
    closing: "0.0000000000"
  });
  assert.deepEqual(computeCarry("0.0000000000", "-40.0000000000"), {
    opening: "0.0000000000",
    periodNet: "-40.0000000000",
    available: "-40.0000000000",
    amountDue: "0.0000000000",
    closing: "-40.0000000000"
  });
  assert.deepEqual(computeCarry("-100.0000000000", "30.0000000000"), {
    opening: "-100.0000000000",
    periodNet: "30.0000000000",
    available: "-70.0000000000",
    amountDue: "0.0000000000",
    closing: "-70.0000000000"
  });
  assert.deepEqual(computeCarry("-100.0000000000", "150.0000000000"), {
    opening: "-100.0000000000",
    periodNet: "150.0000000000",
    available: "50.0000000000",
    amountDue: "50.0000000000",
    closing: "0.0000000000"
  });
});

test("statement generation aggregates allocations and appends one balance ledger row", () => {
  const plan = buildStatementPlan(payee, period, "USD", allocations, "-20.0000000000", 3);

  assert.deepEqual(plan.statement, {
    payeeId: "payee_a",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    currency: "USD",
    grossTotal: "150.0000000000",
    recoupmentTotal: "25.0000000000",
    netPayable: "125.0000000000",
    amountDue: "105.0000000000",
    version: 3,
    status: "generated"
  });
  assert.deepEqual(plan.lines, [
    {
      earningAllocationId: "allocation_1",
      trackId: "track_1",
      grossShare: "100.0000000000",
      recoupmentApplied: "25.0000000000",
      netPayable: "75.0000000000",
      quantity: "10.000000",
      currency: "USD"
    },
    {
      earningAllocationId: "allocation_2",
      trackId: "track_2",
      grossShare: "50.0000000000",
      recoupmentApplied: "0.0000000000",
      netPayable: "50.0000000000",
      quantity: "5.500000",
      currency: "USD"
    }
  ]);
  assert.deepEqual(plan.balanceLedgerRow, {
    payeeId: "payee_a",
    statementId: null,
    currency: "USD",
    openingBalance: "-20.0000000000",
    periodNet: "125.0000000000",
    closingBalance: "0.0000000000",
    movementType: "statement"
  });
});

test("generate all for period reads the latest closing per payee and currency", () => {
  const lastClosings: readonly PayeeBalanceLedgerInput[] = [
    ledger("ledger_old", "payee_a", "USD", "0.0000000000", "-90.0000000000", "-90.0000000000", "2026-01-10T00:00:00.000Z"),
    ledger("ledger_latest", "payee_a", "USD", "-90.0000000000", "10.0000000000", "-80.0000000000", "2026-01-20T00:00:00.000Z")
  ];
  const plans = buildStatementsForPeriod([payee], period, allocations, lastClosings);

  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.balanceLedgerRow.openingBalance, "-80.0000000000");
  assert.equal(plans[0]?.statement.amountDue, "45.0000000000");
});

test("void appends a reversal ledger row and marks the statement void", () => {
  const originalLedger = ledger("ledger_statement", "payee_a", "USD", "-20.0000000000", "125.0000000000", "0.0000000000", "2026-02-01T00:00:00.000Z");
  const plan = buildVoidPlan({ id: "statement_1", status: "generated" }, originalLedger);

  assert.deepEqual(plan, {
    reversalLedgerRow: {
      payeeId: "payee_a",
      statementId: "statement_1",
      currency: "USD",
      openingBalance: "0.0000000000",
      periodNet: "-125.0000000000",
      closingBalance: "-20.0000000000",
      movementType: "void_reversal"
    },
    statementStatusUpdate: {
      id: "statement_1",
      status: "void"
    }
  });
});

test("statement balance subtracts applied payments exactly", () => {
  assert.deepEqual(
    computeStatementBalance(
      { id: "statement_1", currency: "USD", amountDue: "100.0000000000" },
      [
        { statementId: "statement_1", currency: "USD", amountApplied: "10.1000000000" },
        { statementId: "statement_1", currency: "USD", amountApplied: "0.2000000000" }
      ]
    ),
    {
      statementId: "statement_1",
      currency: "USD",
      amountDue: "100.0000000000",
      paymentsApplied: "10.3000000000",
      statementBalance: "89.7000000000"
    }
  );
});

test("statement group totals use exact scale-10 arithmetic, avoiding PHP cast drift", () => {
  const totals = computeStatementGroupTotals(
    [
      { id: "statement_a", currency: "USD", amountDue: "0.3000000000" },
      { id: "statement_b", currency: "USD", amountDue: "0.3000000000" },
      { id: "statement_c", currency: "EUR", amountDue: "1.0000000000" }
    ],
    [
      { statementId: "statement_a", currency: "USD", amountApplied: "0.1000000000" },
      { statementId: "statement_b", currency: "USD", amountApplied: "0.2000000000" },
      { statementId: "statement_c", currency: "EUR", amountApplied: "0.3333333333" }
    ]
  );

  assert.deepEqual(totals, [
    { currency: "EUR", statementBalance: "0.6666666667" },
    { currency: "USD", statementBalance: "0.3000000000" }
  ]);
});

function ledger(
  id: string,
  payeeId: string,
  currency: string,
  openingBalance: string,
  periodNet: string,
  closingBalance: string,
  createdAt: string
): PayeeBalanceLedgerInput {
  return {
    id,
    payeeId,
    statementId: null,
    currency,
    openingBalance,
    periodNet,
    closingBalance,
    movementType: "statement",
    createdAt
  };
}
