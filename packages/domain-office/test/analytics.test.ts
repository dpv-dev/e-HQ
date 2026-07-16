import assert from "node:assert/strict";
import test from "node:test";
import {
  type OfficeAnalyticsDataset,
  readOfficeBankQuality,
  readOfficeCashRunway,
  readOfficeCashflowProjection,
  readOfficeDashboardFull
} from "../src/analytics.ts";
import { readMonthlyPnl } from "../src/pl.ts";

const filters = {
  dateFrom: "2026-01-01",
  dateTo: "2026-02-28",
  departmentId: null
};

const fixture: OfficeAnalyticsDataset = {
  departments: [{ id: "dept_office", name: "Office", type: "mixed", color: null, isActive: true }],
  divisions: [{ id: "div_ops", departmentId: "dept_office", name: "Operations", isActive: true }],
  categories: [
    { id: "cat_income", divisionId: "div_ops", name: "Income", type: "income", isActive: true },
    { id: "cat_expense", divisionId: "div_ops", name: "Expense", type: "expense", isActive: true }
  ],
  partners: [],
  projects: [],
  projectBudgetLines: [],
  transactions: [
    {
      id: "tx_jan_income",
      transactionDate: "2026-01-10T10:00:00.000Z",
      type: "income",
      status: "validated",
      isActive: true,
      description: "January income",
      categoryId: "cat_income",
      partnerId: null,
      projectId: null,
      amountMinor: 100_000n,
      originalCurrency: null,
      exchangeRateE10: null
    },
    {
      id: "tx_jan_expense",
      transactionDate: "2026-01-11T10:00:00.000Z",
      type: "expense",
      status: "validated",
      isActive: true,
      description: "January expense",
      categoryId: "cat_expense",
      partnerId: null,
      projectId: null,
      amountMinor: 200_000n,
      originalCurrency: null,
      exchangeRateE10: null
    },
    {
      id: "tx_feb_expense",
      transactionDate: "2026-02-11T10:00:00.000Z",
      type: "expense",
      status: "validated",
      isActive: true,
      description: "February expense",
      categoryId: "cat_expense",
      partnerId: null,
      projectId: null,
      amountMinor: 100_000n,
      originalCurrency: null,
      exchangeRateE10: null
    }
  ],
  financialAllocations: [
    { id: "alloc_jan_income", transactionId: "tx_jan_income", departmentId: "dept_office", amountMinor: 100_000n },
    { id: "alloc_jan_expense", transactionId: "tx_jan_expense", departmentId: "dept_office", amountMinor: 200_000n },
    { id: "alloc_feb_expense", transactionId: "tx_feb_expense", departmentId: "dept_office", amountMinor: 100_000n }
  ],
  bankAccounts: [
      {
        id: "bank_mur",
        workspaceId: "workspace_1",
        bankName: "MCB",
        accountLabel: "MUR",
        accountReferenceHash: "test-bank-mur",
        currency: "MUR",
      currentBalanceMinor: 200_000n,
      currentBalanceMurMinor: null,
      isActive: true,
      balanceAsOf: "2026-02-28T18:00:00.000Z"
    },
      {
        id: "bank_eur",
        workspaceId: "workspace_1",
        bankName: "MCB",
        accountLabel: "EUR",
        accountReferenceHash: "test-bank-eur",
        currency: "EUR",
      currentBalanceMinor: 1_000n,
      currentBalanceMurMinor: 50_000n,
      isActive: true,
      balanceAsOf: "2026-02-28T18:00:00.000Z"
    }
  ],
  bankImportBatches: [
      {
        id: "batch_jan",
        workspaceId: "workspace_1",
        source: "mcb",
        fileName: "batch-jan.csv",
        checksum: "batch-jan",
        accountId: "bank_mur",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        openingBalanceMinor: null,
        closingBalanceMinor: 200_000n,
        currency: "MUR",
        acceptedRowCount: 3,
        rejectedRowCount: 0,
        duplicateRowCount: 1,
        idempotencyFingerprint: "batch-jan",
        status: "confirmed",
        importedAt: "2026-01-31T12:00:00.000Z",
        metadata: {}
      },
      {
        id: "batch_old",
        workspaceId: "workspace_1",
        source: "sbi",
        fileName: "batch-old.csv",
        checksum: "batch-old",
        accountId: "bank_mur",
        periodStart: "2025-12-01",
        periodEnd: "2025-12-31",
        openingBalanceMinor: null,
        closingBalanceMinor: 100_000n,
        currency: "MUR",
        acceptedRowCount: 1,
        rejectedRowCount: 0,
        duplicateRowCount: 0,
        idempotencyFingerprint: "batch-old",
        status: "confirmed",
        importedAt: "2025-12-31T12:00:00.000Z",
        metadata: {}
      }
  ],
  bankStatementLines: [
      {
        id: "line_matched",
        importBatchId: "batch_jan",
        accountId: "bank_mur",
        occurredOn: "2026-01-10",
        valueOn: null,
        description: "Matched line",
        reference: "REF-1",
        direction: "credit",
        amountMinor: 100_000n,
        balanceMinor: 100_000n,
        currency: "MUR",
        amountMurMinor: 100_000n,
        balanceMurMinor: 100_000n,
        isDuplicateCandidate: false,
        reconciliationStatus: "matched",
        matchedTransactionId: "tx_jan_income",
        rawData: {}
      },
      {
        id: "line_suggested_matched",
        importBatchId: "batch_jan",
        accountId: "bank_mur",
        occurredOn: "2026-01-11",
        valueOn: null,
        description: "Suggested line",
        reference: "",
        direction: "debit",
        amountMinor: 200_000n,
        balanceMinor: 300_000n,
        currency: "MUR",
        amountMurMinor: 200_000n,
        balanceMurMinor: 300_000n,
        isDuplicateCandidate: true,
        reconciliationStatus: "suggested",
        matchedTransactionId: null,
        rawData: {}
      },
      {
        id: "line_unmatched",
        importBatchId: "batch_jan",
        accountId: "bank_mur",
        occurredOn: "2026-01-12",
        valueOn: null,
        description: "Unmatched line",
        reference: "REF-3",
        direction: "debit",
        amountMinor: 10_000n,
        balanceMinor: 290_000n,
        currency: "MUR",
        amountMurMinor: 10_000n,
        balanceMurMinor: 290_000n,
        isDuplicateCandidate: false,
        reconciliationStatus: "unmatched",
        matchedTransactionId: null,
        rawData: {}
      }
  ],
  bankReconciliationMatches: [
    {
      id: "match_1",
      bankStatementLineId: "line_suggested_matched",
      transactionId: "tx_jan_expense",
      confidenceBp: 9800,
      status: "matched",
      approvedByUserId: "test-user",
      approvedAt: "2026-01-31T13:00:00.000Z"
    }
  ],
  cashflowProjectionRows: [
    {
      id: "cash_jan",
      importBatchId: null,
      workspaceId: "workspace_1",
      accountId: "bank_mur",
      periodMonth: "2026-01",
      expectedInflowMinor: 100_000n,
      expectedOutflowMinor: 200_000n,
      expectedClosingBalanceMinor: 300_000n,
      currency: "MUR",
      createdAt: "2026-01-31T00:00:00.000Z"
    },
    {
      id: "cash_feb",
      importBatchId: null,
      workspaceId: "workspace_1",
      accountId: "bank_mur",
      periodMonth: "2026-02",
      expectedInflowMinor: 0n,
      expectedOutflowMinor: 100_000n,
      expectedClosingBalanceMinor: 250_000n,
      currency: "MUR",
      createdAt: "2026-02-28T00:00:00.000Z"
    }
  ]
};

test("bank quality derives matched rate and exception counts from bank tables", () => {
  assert.deepEqual(readOfficeBankQuality(fixture, "2026-01"), {
    period: "2026-01",
    totalLineCount: 3,
    matchedLineCount: 2,
    matchedRateBp: 6667,
    unmatchedLineCount: 1,
    duplicateCandidateCount: 1,
    missingReferenceCount: 1,
    staleImportCount: 1,
    lastImportAt: "2026-01-31T12:00:00.000Z"
  });
});

test("cash runway emits exact MUR amounts and only runwayMonths is a rounded ratio", () => {
  const monthly = readMonthlyPnl(fixture, filters);
  assert.deepEqual(readOfficeCashRunway(fixture, "2026-02", monthly, ["2026-01", "2026-02"]), {
    period: "2026-02",
    cashBalanceMur: "2500.00",
    averageMonthlyBurnMur: "1000.00",
    runwayMonths: "2.50",
    monthsUsed: ["2026-01", "2026-02"]
  });
});

test("cashflow projection buckets stay exact MUR kernel strings", () => {
  assert.deepEqual(readOfficeCashflowProjection(fixture, "2026-01-01", "2026-02-28", null), [
    { period: "2026-01", inflowMur: "1000.00", outflowMur: "2000.00", closingMur: "3000.00" },
    { period: "2026-02", inflowMur: "0.00", outflowMur: "1000.00", closingMur: "2500.00" }
  ]);
});

test("cashflow projection keeps only the most recent row per account+month instead of summing duplicates", () => {
  const withDuplicateReimport = {
    ...fixture,
    cashflowProjectionRows: [
      ...fixture.cashflowProjectionRows,
      {
        id: "cash_jan_reimport",
        importBatchId: null,
        workspaceId: "workspace_1",
        accountId: "bank_mur",
        periodMonth: "2026-01",
        expectedInflowMinor: 150_000n,
        expectedOutflowMinor: 250_000n,
        expectedClosingBalanceMinor: 400_000n,
        currency: "MUR",
        createdAt: "2026-02-15T00:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(readOfficeCashflowProjection(withDuplicateReimport, "2026-01-01", "2026-01-31", null), [
    { period: "2026-01", inflowMur: "1500.00", outflowMur: "2500.00", closingMur: "4000.00" }
  ]);
});

test("full dashboard composes P&L, monthly, bank quality, runway, and cashflow", () => {
  const dashboard = readOfficeDashboardFull(fixture, "2026-02", filters, ["2026-01", "2026-02"]);
  assert.equal(dashboard.pnl.profit, "-2000.00");
  assert.deepEqual(dashboard.byDepartment, [
    {
      department_id: "dept_office",
      department_name: "Office",
      department_type: "mixed",
      income: "1000.00",
      expense: "3000.00",
      profit: "-2000.00",
      tx_count: 3
    }
  ]);
  assert.deepEqual(dashboard.monthly, [
    { month: "2026-01", income: "1000.00", expense: "2000.00", profit: "-1000.00" },
    { month: "2026-02", income: "0.00", expense: "1000.00", profit: "-1000.00" }
  ]);
  assert.equal(dashboard.cashRunway.runwayMonths, "2.50");
});
