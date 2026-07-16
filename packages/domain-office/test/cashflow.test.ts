import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficeCashflowWorkbench,
  calculateAdvanceBalance,
  type OfficeCashflowManualEntryRow,
  type OfficeAdvanceApplicationRow,
  type OfficeManagedAdvanceRow
} from "../src/index.js";

const managedAdvance: OfficeManagedAdvanceRow = {
  id: "advance-1",
  workspaceId: "eeee-mu",
  beneficiaryType: "staff",
  beneficiaryName: "Alex Morgan",
  partnerId: null,
  projectId: null,
  bankStatementLineId: null,
  transactionId: null,
  label: "Artist travel deposit",
  plannedPaymentOn: "2026-07-15",
  paidOn: null,
  originalAmountMinor: 40_000n,
  currency: "MUR",
  status: "planned",
  notes: null,
  createdByUserId: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
};

test("cash-flow workbench combines validated actuals, latest forecast, manual adjustments and planned advances", () => {
  const manualEntry: OfficeCashflowManualEntryRow = {
    id: "manual-1",
    workspaceId: "eeee-mu",
    accountId: null,
    partnerId: null,
    projectId: null,
    entryDate: "2026-07-20",
    direction: "inflow",
    amountMinor: 20_000n,
    currency: "MUR",
    label: "Expected sponsor payment",
    notes: null,
    status: "planned",
    createdByUserId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
  const rows = buildOfficeCashflowWorkbench({
    workspaceId: "eeee-mu",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    accountId: null,
    transactions: [
      {
        id: "transaction-1",
        workspaceId: "eeee-mu",
        transactionDate: "2026-07-04T10:00:00.000Z",
        type: "income",
        status: "validated",
        isActive: true,
        description: "Ticket sales",
        categoryId: null,
        partnerId: null,
        projectId: null,
        accountId: null,
        amountMinor: 80_000n,
        originalCurrency: null,
        exchangeRateE10: null
      }
    ],
    projectionRows: [
      {
        id: "old",
        importBatchId: null,
        workspaceId: "eeee-mu",
        accountId: null,
        periodMonth: "2026-07",
        expectedInflowMinor: 10_000n,
        expectedOutflowMinor: 5_000n,
        expectedClosingBalanceMinor: 100_000n,
        currency: "MUR",
        createdAt: "2026-06-01T00:00:00.000Z"
      },
      {
        id: "latest",
        importBatchId: null,
        workspaceId: "eeee-mu",
        accountId: null,
        periodMonth: "2026-07",
        expectedInflowMinor: 30_000n,
        expectedOutflowMinor: 10_000n,
        expectedClosingBalanceMinor: 120_000n,
        currency: "MUR",
        createdAt: "2026-06-02T00:00:00.000Z"
      }
    ],
    manualEntries: [manualEntry],
    advances: [managedAdvance]
  });

  assert.deepEqual(rows, [
    {
      period: "2026-07",
      actualInflowMinor: 80_000n,
      actualOutflowMinor: 0n,
      forecastInflowMinor: 50_000n,
      forecastOutflowMinor: 50_000n,
      varianceMinor: 80_000n,
      forecastClosingMinor: 100_000n
    }
  ]);
});

test("a paid beneficiary advance linked to a transaction is not double-counted", () => {
  const rows = buildOfficeCashflowWorkbench({
    workspaceId: "eeee-mu",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    accountId: null,
    transactions: [],
    projectionRows: [],
    manualEntries: [],
    advances: [{ ...managedAdvance, status: "paid", paidOn: "2026-07-15", transactionId: "transaction-1" }]
  });
  assert.deepEqual(rows, []);
});

test("advance applications preserve outstanding and reject over-application", () => {
  const application: OfficeAdvanceApplicationRow = {
    id: "application-1",
    advanceId: managedAdvance.id,
    appliedOn: "2026-07-20",
    amountMinor: 15_000n,
    kind: "expense",
    reference: null,
    notes: null,
    createdByUserId: null,
    createdAt: "2026-07-20T00:00:00.000Z"
  };
  assert.deepEqual(calculateAdvanceBalance(managedAdvance, [application]), {
    appliedMinor: 15_000n,
    outstandingMinor: 25_000n,
    status: "partially_applied"
  });
  assert.throws(() => calculateAdvanceBalance(managedAdvance, [application], 30_000n), /exceeds/);
});
