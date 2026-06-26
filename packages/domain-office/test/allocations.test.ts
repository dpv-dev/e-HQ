import assert from "node:assert/strict";
import test from "node:test";
import {
  type OfficeAllocationError,
  type OfficeAllocationReplaceDataset,
  type OfficeIncomingAllocation,
  type OfficeWriteExchangeRateRow,
  type OfficeWriteTransactionRow,
  allocationsAreComplete,
  createReplaceAllocationsPlan,
  transactionCanBeValidated
} from "../src/allocations.ts";

const departments = [
  { id: "dept_music", isActive: true },
  { id: "dept_office", isActive: true },
  { id: "dept_events", isActive: true },
  { id: "dept_inactive", isActive: false }
];

const plainTransaction: OfficeWriteTransactionRow = {
  id: "tx_plain",
  type: "expense",
  status: "draft",
  categoryId: "cat_plain",
  projectId: null,
  amountMinor: 10_000n,
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRateE10: null,
  vatApplicable: false,
  vatAmountMinor: 0n,
  transactionDate: "2026-05-10T10:00:00.000Z"
};

const sharedCostTransaction: OfficeWriteTransactionRow = {
  ...plainTransaction,
  id: "tx_shared",
  categoryId: "cat_shared",
  amountMinor: 100n
};

const exchangeRates: readonly OfficeWriteExchangeRateRow[] = [
  {
    fromCurrency: "USD",
    toCurrency: "MUR",
    rateE10: 450_000_000_000n,
    effectiveDate: "2026-05-10"
  }
];

const threeWayAllocations: readonly OfficeIncomingAllocation[] = [
  { departmentId: "dept_music", percentageBp: 3333, amountMinor: 3333n, roleSlug: "primary" },
  { departmentId: "dept_office", percentageBp: 3333, amountMinor: 3333n, roleSlug: "support" },
  { departmentId: "dept_events", percentageBp: 3334, amountMinor: 3334n, roleSlug: null }
];

const baseDataset: OfficeAllocationReplaceDataset = {
  transactions: [plainTransaction, sharedCostTransaction],
  departments,
  existingAllocations: [
    {
      id: "alloc_old",
      transactionId: "tx_plain",
      departmentId: "dept_music",
      roleSlug: "",
      percentageBp: 10000,
      amountMinor: 10_000n
    }
  ],
  sharedCostRules: [
    { id: "rule_music", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_music", percentageBp: 3333, isActive: true },
    { id: "rule_office", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_office", percentageBp: 3333, isActive: true },
    { id: "rule_events", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_events", percentageBp: 3334, isActive: true }
  ],
  projectDepartments: []
};

test("allocation completeness accepts the EOF one-unit tolerance and rejects bad totals", () => {
  assert.equal(allocationsAreComplete(10_000n, threeWayAllocations), true);
  assert.equal(
    allocationsAreComplete(10_000n, [
      { departmentId: "dept_music", percentageBp: 5000, amountMinor: 5000n, roleSlug: null },
      { departmentId: "dept_office", percentageBp: 4000, amountMinor: 5000n, roleSlug: null }
    ]),
    false
  );
  assert.equal(
    allocationsAreComplete(10_000n, [
      { departmentId: "dept_music", percentageBp: 5000, amountMinor: 5000n, roleSlug: null },
      { departmentId: "dept_office", percentageBp: 5000, amountMinor: 4000n, roleSlug: null }
    ]),
    false
  );
});

test("transaction validation returns stable failure reasons and accepts complete FX-backed rows", () => {
  assert.deepEqual(transactionCanBeValidated(plainTransaction, [], []), {
    ok: false,
    reason: "allocations_missing",
    context: {
      transactionId: "tx_plain",
      amountMinor: "10000"
    }
  });

  assert.deepEqual(transactionCanBeValidated({ ...plainTransaction, id: "tx_zero", amountMinor: 0n }, [], []), { ok: true });

  assert.deepEqual(transactionCanBeValidated({ ...plainTransaction, id: "tx_vat", vatApplicable: true, vatAmountMinor: 0n }, threeWayAllocations, []), {
    ok: false,
    reason: "vat_missing",
    context: {
      transactionId: "tx_vat",
      vatAmountMinor: "0"
    }
  });

  assert.deepEqual(
    transactionCanBeValidated(
      {
        ...plainTransaction,
        id: "tx_fx_missing",
        originalAmountMinor: 1000n,
        originalCurrency: "USD",
        exchangeRateE10: null
      },
      threeWayAllocations,
      exchangeRates
    ),
    {
      ok: false,
      reason: "fx_missing",
      context: {
        transactionId: "tx_fx_missing",
        originalCurrency: "USD"
      }
    }
  );

  assert.deepEqual(
    transactionCanBeValidated(
      {
        ...plainTransaction,
        id: "tx_fx_ready",
        originalAmountMinor: 1000n,
        originalCurrency: "USD",
        exchangeRateE10: 450_000_000_000n
      },
      threeWayAllocations,
      exchangeRates
    ),
    { ok: true }
  );
});

test("replace allocation plan keeps client-supplied lines and emits before-after audit", () => {
  const plan = createReplaceAllocationsPlan(baseDataset, {
    transactionId: "tx_plain",
    allocations: threeWayAllocations,
    knownRoleSlugs: ["primary", "support"],
    actorUserId: "user_david",
    now: "2026-06-21T08:00:00.000Z"
  });

  assert.equal(plan.deleteExistingAllocations, true);
  assert.deepEqual(plan.insertAllocations, [
    { transactionId: "tx_plain", departmentId: "dept_music", percentageBp: 3333, amountMinor: 3333n, roleSlug: "primary" },
    { transactionId: "tx_plain", departmentId: "dept_office", percentageBp: 3333, amountMinor: 3333n, roleSlug: "support" },
    { transactionId: "tx_plain", departmentId: "dept_events", percentageBp: 3334, amountMinor: 3334n, roleSlug: "" }
  ]);
  assert.deepEqual(plan.auditEvent.before, baseDataset.existingAllocations);
  assert.deepEqual(plan.auditEvent.after, plan.insertAllocations);
});

test("shared-cost expansion uses remainder-last and reconciles generated amounts exactly", () => {
  const plan = createReplaceAllocationsPlan(baseDataset, {
    transactionId: "tx_shared",
    allocations: [{ departmentId: "dept_music", percentageBp: 10000, amountMinor: 100n, roleSlug: null }],
    knownRoleSlugs: [],
    actorUserId: "user_david",
    now: "2026-06-21T08:00:00.000Z"
  });

  assert.deepEqual(plan.insertAllocations, [
    { transactionId: "tx_shared", departmentId: "dept_music", percentageBp: 3333, amountMinor: 33n, roleSlug: "" },
    { transactionId: "tx_shared", departmentId: "dept_office", percentageBp: 3333, amountMinor: 33n, roleSlug: "" },
    { transactionId: "tx_shared", departmentId: "dept_events", percentageBp: 3334, amountMinor: 34n, roleSlug: "" }
  ]);
  assert.equal(plan.insertAllocations.reduce((sum: bigint, allocation) => sum + allocation.amountMinor, 0n), 100n);
});

test("shared-cost expansion normalizes the EOF one-basis-point tolerance before splitting", () => {
  const toleranceDataset: OfficeAllocationReplaceDataset = {
    ...baseDataset,
    sharedCostRules: [
      { id: "rule_music", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_music", percentageBp: 3333, isActive: true },
      { id: "rule_office", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_office", percentageBp: 3333, isActive: true },
      { id: "rule_events", sourceCategoryId: "cat_shared", targetDepartmentId: "dept_events", percentageBp: 3333, isActive: true }
    ]
  };
  const plan = createReplaceAllocationsPlan(toleranceDataset, {
    transactionId: "tx_shared",
    allocations: [{ departmentId: "dept_music", percentageBp: 10000, amountMinor: 100n, roleSlug: null }],
    knownRoleSlugs: [],
    actorUserId: "user_david",
    now: "2026-06-21T08:00:00.000Z"
  });

  assert.deepEqual(
    plan.insertAllocations.map((allocation) => allocation.percentageBp),
    [3333, 3333, 3334]
  );
});

test("replace allocation plan rejects read-only transactions", () => {
  const readOnlyDataset: OfficeAllocationReplaceDataset = {
    ...baseDataset,
    transactions: [
      { ...plainTransaction, id: "tx_validated", status: "validated" },
      { ...plainTransaction, id: "tx_cancelled", status: "cancelled" }
    ]
  };

  assert.throws(
    () =>
      createReplaceAllocationsPlan(readOnlyDataset, {
        transactionId: "tx_validated",
        allocations: threeWayAllocations,
        knownRoleSlugs: ["primary", "support"],
        actorUserId: "user_david",
        now: "2026-06-21T08:00:00.000Z"
      }),
    (error: unknown) => hasOfficeAllocationError(error, "transaction_read_only")
  );
  assert.throws(
    () =>
      createReplaceAllocationsPlan(readOnlyDataset, {
        transactionId: "tx_cancelled",
        allocations: threeWayAllocations,
        knownRoleSlugs: ["primary", "support"],
        actorUserId: "user_david",
        now: "2026-06-21T08:00:00.000Z"
      }),
    (error: unknown) => hasOfficeAllocationError(error, "transaction_read_only")
  );
});

test("replace allocation plan rejects incomplete incoming lines before persistence", () => {
  assert.throws(
    () =>
      createReplaceAllocationsPlan(baseDataset, {
        transactionId: "tx_plain",
        allocations: [
          { departmentId: "dept_music", percentageBp: 5000, amountMinor: 5000n, roleSlug: null },
          { departmentId: "dept_office", percentageBp: 4000, amountMinor: 5000n, roleSlug: null }
        ],
        knownRoleSlugs: [],
        actorUserId: "user_david",
        now: "2026-06-21T08:00:00.000Z"
      }),
    (error: unknown) => hasOfficeAllocationError(error, "allocations_incomplete")
  );
});

test("project auto-add is explicit and idempotent in the returned plan", () => {
  const projectDataset: OfficeAllocationReplaceDataset = {
    ...baseDataset,
    transactions: [{ ...plainTransaction, id: "tx_project", projectId: "project_alma" }],
    projectDepartments: [{ projectId: "project_alma", departmentId: "dept_music" }]
  };

  const plan = createReplaceAllocationsPlan(projectDataset, {
    transactionId: "tx_project",
    allocations: [
      { departmentId: "dept_music", percentageBp: 5000, amountMinor: 5000n, roleSlug: null },
      { departmentId: "dept_office", percentageBp: 5000, amountMinor: 5000n, roleSlug: null }
    ],
    knownRoleSlugs: [],
    actorUserId: "user_david",
    now: "2026-06-21T08:00:00.000Z"
  });

  assert.deepEqual(plan.insertProjectDepartments, [{ projectId: "project_alma", departmentId: "dept_office" }]);
  assert.deepEqual(plan.alerts, [
    {
      level: "info",
      code: "project_department_auto_added",
      projectId: "project_alma",
      departmentId: "dept_office",
      message: "Project department was added because an allocation targets it."
    }
  ]);
});

function hasOfficeAllocationError(error: unknown, code: OfficeAllocationError["code"]): boolean {
  return error instanceof Error && "code" in error && (error as OfficeAllocationError).code === code;
}
