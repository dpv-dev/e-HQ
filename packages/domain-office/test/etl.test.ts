import assert from "node:assert/strict";
import test from "node:test";
import {
  type LegacyOfficeDump,
  type OfficeB2Contract,
  assertOfficeB2IngestionGuard,
  officeB2LiveContract,
  transformOfficeLegacyDump
} from "../src/etl.ts";

const fixtureContract: OfficeB2Contract = {
  sourceDatabaseName: "fixture",
  tablePrefix: "wp_",
  expectedCounts: {
    transactions: 5,
    financialAllocations: 2,
    categories: 3,
    departments: 4,
    partners: 1,
    projects: 1,
    bankAccounts: 1,
    bankRawTransactions: 2,
    bankReconciliations: 1
  },
  expectedTransactionStatusCounts: {
    validated: 3,
    draft: 1,
    cancelled: 1
  },
  expectedQuality: {
    inconsistentCategories: 0,
    emptyCurrencyRows: 0,
    allocationSumMismatch: 0,
    orphanForeignKeys: 0,
    ignoredDivisionNameDrift: 1
  },
  parity: {
    validatedTransactionCount: 2,
    incomeMinor: 10_000n,
    expenseMinor: 4_000n
  }
};

function createFixtureDump(): LegacyOfficeDump {
  return {
    departments: [
      {
        id: "dept_music",
        name: "Music",
        slug: "music",
        parentId: null,
        type: "mixed",
        color: null,
        isActive: 1,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "div_streaming",
        name: "Streaming",
        slug: "streaming",
        parentId: "dept_music",
        type: null,
        color: null,
        isActive: 1,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "dept_ops",
        name: "Operations",
        slug: "operations",
        parentId: null,
        type: "expense",
        color: null,
        isActive: 1,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "div_admin",
        name: "Admin",
        slug: "admin",
        parentId: "dept_ops",
        type: null,
        color: null,
        isActive: 1,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    categories: [
      {
        id: "cat_streaming",
        name: "Streaming revenue",
        type: "income",
        departmentId: "dept_music",
        divisionId: "div_streaming",
        isActive: 1
      },
      {
        id: "cat_bank_fee",
        name: "Bank fees",
        type: "expense",
        departmentId: "dept_ops",
        divisionId: "div_admin",
        isActive: 1
      },
      {
        id: "cat_legacy_inactive",
        name: "Legacy inactive",
        type: "expense",
        departmentId: null,
        divisionId: null,
        isActive: 0
      }
    ],
    partners: [
      {
        id: "partner_kontor",
        name: "Kontor",
        type: "client",
        isActive: 1
      }
    ],
    projects: [
      {
        id: "project_catalog",
        name: "Catalog",
        status: "active",
        state: "active",
        isActive: 1
      }
    ],
    bankAccounts: [
      {
        id: "bank_1",
        name: "MCB Current",
        accountNumber: "000455164517",
        bankName: null,
        currency: "MUR",
        isActive: 1,
        institution: "Mauritius Commercial Bank"
      }
    ],
    transactions: [
      {
        id: "tx_income",
        transactionDate: "2026-02-01T10:00:00.000Z",
        type: "income",
        status: "validated",
        isActive: 1,
        description: "Streaming revenue",
        categoryId: "cat_streaming",
        partnerId: "partner_kontor",
        projectId: "project_catalog",
        amountMur: "100.00",
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null
      },
      {
        id: "tx_expense",
        transactionDate: "2026-02-02T10:00:00.000Z",
        type: "expense",
        status: "validated",
        isActive: 1,
        description: "Bank fees",
        categoryId: "cat_bank_fee",
        partnerId: null,
        projectId: null,
        amountMur: "40.00",
        originalAmount: null,
        originalCurrency: "MUR",
        exchangeRate: null
      },
      {
        id: "tx_draft",
        transactionDate: "2026-02-03T10:00:00.000Z",
        type: "income",
        status: "draft",
        isActive: 1,
        description: "Draft row",
        categoryId: "cat_streaming",
        partnerId: null,
        projectId: null,
        amountMur: "999.00",
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null
      },
      {
        id: "tx_cancelled",
        transactionDate: "2026-02-04T10:00:00.000Z",
        type: "expense",
        status: "cancelled",
        isActive: 1,
        description: "Cancelled row",
        categoryId: "cat_legacy_inactive",
        partnerId: null,
        projectId: null,
        amountMur: "777.77",
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null
      },
      {
        id: "tx_inactive",
        transactionDate: "2026-02-05T10:00:00.000Z",
        type: "income",
        status: "validated",
        isActive: 0,
        description: "Inactive row",
        categoryId: "cat_streaming",
        partnerId: null,
        projectId: null,
        amountMur: "999.00",
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null
      }
    ],
    financialAllocations: [
      {
        id: "alloc_income",
        transactionId: "tx_income",
        departmentId: "dept_music",
        divisionName: "Music",
        amountMur: "100.00",
        percentageBp: "10000",
        roleSlug: null
      },
      {
        id: "alloc_expense",
        transactionId: "tx_expense",
        departmentId: "dept_ops",
        divisionName: "Admin",
        amountMur: "40.00",
        percentageBp: "10000",
        roleSlug: null
      }
    ],
    bankRawTransactions: [
      {
        id: "bank_1",
        importId: "import_1",
        accountId: "bank_1",
        externalId: "ext_1",
        transactionDate: "2026-01-01 00:00:00",
        description: "Kontor payment",
        direction: "credit",
        amount: "100.00",
        balance: "100.00",
        status: "matched",
        rawPayload: null,
        createdAt: "2026-01-01 12:00:00",
        dedupeHash: null
      },
      {
        id: "bank_2",
        importId: "import_1",
        accountId: "bank_1",
        externalId: "ext_2",
        transactionDate: "2026-01-02 00:00:00",
        description: "Bank fee",
        direction: "debit",
        amount: "40.00",
        balance: "60.00",
        status: "pending",
        rawPayload: null,
        createdAt: "2026-01-02 12:00:00",
        dedupeHash: null
      }
    ],
    bankReconciliations: [
      {
        id: "recon_1",
        transactionId: "tx_income",
        bankRawTransactionId: "bank_1",
        amountLinked: "100.00",
        status: "validated",
        validatedByUserId: "user_1",
        validatedAt: "2026-01-03 00:00:00",
        createdAt: "2026-01-02 12:00:00"
      }
    ]
  };
}

test("live B2 contract encodes the confirmed Phase-0 guard and parity numbers", () => {
  assert.equal(officeB2LiveContract.sourceDatabaseName, "u384688932_HZ0LD");
  assert.deepEqual(officeB2LiveContract.expectedCounts, {
    transactions: 3107,
    financialAllocations: 2832,
    categories: 551,
    departments: 93,
    partners: 247,
    projects: 12,
    bankAccounts: 5,
    bankRawTransactions: 3093,
    bankReconciliations: 1568
  });
  assert.deepEqual(officeB2LiveContract.expectedTransactionStatusCounts, {
    validated: 2396,
    draft: 705,
    cancelled: 6
  });
  assert.equal(officeB2LiveContract.parity.validatedTransactionCount, 2396);
  assert.equal(officeB2LiveContract.parity.incomeMinor, 2_214_542_460n);
  assert.equal(officeB2LiveContract.parity.expenseMinor, 1_362_642_716n);
  assert.equal(officeB2LiveContract.expectedQuality.ignoredDivisionNameDrift, 1760);
});

test("ingestion guard aborts before transform when a source table count changes", () => {
  const dump = createFixtureDump();
  const badContract: OfficeB2Contract = {
    ...fixtureContract,
    expectedCounts: {
      ...fixtureContract.expectedCounts,
      transactions: 6
    }
  };

  assert.throws(() => assertOfficeB2IngestionGuard(dump, badContract), /ingestion guard failed for transactions/);
});

test("Office B2 transform derives division through category and ignores allocation division_name", () => {
  const result = transformOfficeLegacyDump(createFixtureDump(), fixtureContract);
  assert.deepEqual(result.dataset.departments, [
    { id: "dept_music", name: "Music", type: "mixed", color: null, isActive: true },
    { id: "dept_ops", name: "Operations", type: "expense", color: null, isActive: true }
  ]);
  assert.deepEqual(result.dataset.divisions, [
    { id: "div_streaming", departmentId: "dept_music", name: "Streaming", isActive: true },
    { id: "div_admin", departmentId: "dept_ops", name: "Admin", isActive: true }
  ]);
  assert.deepEqual(result.dataset.categories, [
    { id: "cat_streaming", name: "Streaming revenue", type: "income", divisionId: "div_streaming", isActive: true },
    { id: "cat_bank_fee", name: "Bank fees", type: "expense", divisionId: "div_admin", isActive: true },
    { id: "cat_legacy_inactive", name: "Legacy inactive", type: "expense", divisionId: null, isActive: false }
  ]);
  assert.equal(result.ignoredDivisionNameDriftCount, 1);
  assert.equal(Object.hasOwn(result.dataset.financialAllocations[0] ?? {}, "divisionName"), false);
});

test("Office B2 parity proves raw sums and domain-office P&L match the golden master", () => {
  const result = transformOfficeLegacyDump(createFixtureDump(), fixtureContract);
  assert.deepEqual(result.parityReport, {
    transactionStatusCounts: {
      validated: 3,
      draft: 1,
      cancelled: 1
    },
    rawValidatedTransactionCount: 2,
    rawIncomeMinor: 10_000n,
    rawExpenseMinor: 4_000n,
    engineIncomeMinor: 10_000n,
    engineExpenseMinor: 4_000n,
    projectPartnerOrgWideDivergence: "expected_wp_bug_m1"
  });
});

test("Office B2 migrates draft and cancelled transactions as-is while excluding them from P&L", () => {
  const result = transformOfficeLegacyDump(createFixtureDump(), fixtureContract);
  const draft = result.dataset.transactions.find((transaction) => transaction.id === "tx_draft");
  const cancelled = result.dataset.transactions.find((transaction) => transaction.id === "tx_cancelled");

  assert.equal(result.dataset.transactions.length, 5);
  assert.equal(draft?.status, "draft");
  assert.equal(cancelled?.status, "cancelled");
  assert.deepEqual(result.parityReport.transactionStatusCounts, {
    validated: 3,
    draft: 1,
    cancelled: 1
  });
  assert.equal(result.parityReport.rawValidatedTransactionCount, 2);
  assert.equal(result.parityReport.engineIncomeMinor, 10_000n);
  assert.equal(result.parityReport.engineExpenseMinor, 4_000n);
});

test("Office B2 orphan FK guard accepts draft/cancelled rows and inactive referenced categories", () => {
  const result = transformOfficeLegacyDump(createFixtureDump(), fixtureContract);
  const cancelled = result.dataset.transactions.find((transaction) => transaction.id === "tx_cancelled");

  assert.equal(cancelled?.status, "cancelled");
  assert.equal(cancelled?.categoryId, "cat_legacy_inactive");
  assert.equal(result.dataset.categories.find((category) => category.id === "cat_legacy_inactive")?.isActive, false);
});

test("Office B2 aborts when category department and division parent disagree", () => {
  const dump = createFixtureDump();
  const brokenDump: LegacyOfficeDump = {
    ...dump,
    categories: dump.categories.map((category) =>
      category.id === "cat_streaming"
        ? {
            ...category,
            departmentId: "dept_ops"
          }
        : category
    )
  };

  assert.throws(() => transformOfficeLegacyDump(brokenDump, fixtureContract), /inconsistent department/);
});

test("Office B2 allows inactive categories without a division so legacy FKs and counts survive", () => {
  const dump = createFixtureDump();
  const result = transformOfficeLegacyDump(dump, fixtureContract);

  assert.equal(result.dataset.categories.length, 3);
  assert.deepEqual(result.dataset.categories.find((category) => category.id === "cat_legacy_inactive"), {
    id: "cat_legacy_inactive",
    name: "Legacy inactive",
    type: "expense",
    divisionId: null,
    isActive: false
  });
});

test("Office B2 still rejects active categories without a coherent division path", () => {
  const dump = createFixtureDump();
  const brokenDump: LegacyOfficeDump = {
    ...dump,
    categories: dump.categories.map((category) =>
      category.id === "cat_legacy_inactive"
        ? {
            ...category,
            isActive: 1
          }
        : category
    )
  };

  assert.throws(() => transformOfficeLegacyDump(brokenDump, fixtureContract), /category\.divisionId is required/);
});
