import assert from "node:assert/strict";
import test from "node:test";
import {
  type OfficePnlDataset,
  type OfficePnlFilters,
  readDepartmentPnl,
  readGlobalPnl,
  readMonthlyPnl,
  readPartnerPnl,
  readPnlByCategory,
  readPnlByDepartment,
  readPnlByDivision,
  readProjectPnl
} from "../src/pl.ts";

const noFilter: OfficePnlFilters = {
  dateFrom: null,
  dateTo: null,
  departmentId: null
};

const musicFilter: OfficePnlFilters = {
  dateFrom: null,
  dateTo: null,
  departmentId: "dept_music"
};

const fixture: OfficePnlDataset = {
  departments: [
    { id: "dept_music", name: "Music", type: "mixed", color: "#music", isActive: true },
    { id: "dept_office", name: "Office", type: "mixed", color: "#office", isActive: true },
    { id: "dept_events", name: "Events", type: "mixed", color: "#events", isActive: true }
  ],
  divisions: [
    { id: "div_music_royalties", departmentId: "dept_music", name: "Royalties", isActive: true },
    { id: "div_office_ops", departmentId: "dept_office", name: "Operations", isActive: true },
    { id: "div_events_live", departmentId: "dept_events", name: "Live", isActive: true }
  ],
  categories: [
    { id: "cat_streaming", divisionId: "div_music_royalties", name: "Streaming", type: "income", isActive: true },
    { id: "cat_studio", divisionId: "div_music_royalties", name: "Studio", type: "expense", isActive: true },
    { id: "cat_rent", divisionId: "div_office_ops", name: "Rent", type: "expense", isActive: true },
    { id: "cat_ticket", divisionId: "div_events_live", name: "Ticket sales", type: "income", isActive: true },
    { id: "cat_stage", divisionId: "div_events_live", name: "Stage build", type: "expense", isActive: true }
  ],
  partners: [
    { id: "partner_kontor", name: "Kontor", type: "client", isActive: true },
    { id: "partner_bedouin", name: "Bedouin Ltd", type: "both", isActive: true },
    { id: "partner_vendor", name: "Studio Vendor", type: "supplier", isActive: true }
  ],
  projects: [
    { id: "project_alma", name: "Alma", status: "active", state: "active", isActive: true },
    { id: "project_show", name: "Island Show", status: "active", state: "active", isActive: true }
  ],
  projectBudgetLines: [
    { id: "budget_alma_income", projectId: "project_alma", categoryId: "cat_streaming", type: "income", plannedAmountMinor: 100_000n },
    { id: "budget_alma_expense", projectId: "project_alma", categoryId: "cat_studio", type: "expense", plannedAmountMinor: 30_000n }
  ],
  transactions: [
    {
      id: "tx_streaming_usd",
      transactionDate: "2026-05-10T10:00:00.000Z",
      type: "income",
      status: "validated",
      isActive: true,
      description: "USD streaming payout",
      categoryId: "cat_streaming",
      partnerId: "partner_kontor",
      projectId: "project_alma",
      amountMinor: 100_000n,
      originalCurrency: "USD",
      exchangeRateE10: 450_000_000_000n
    },
    {
      id: "tx_studio",
      transactionDate: "2026-05-11T10:00:00.000Z",
      type: "expense",
      status: "validated",
      isActive: true,
      description: "Studio booking",
      categoryId: "cat_studio",
      partnerId: "partner_vendor",
      projectId: "project_alma",
      amountMinor: 25_000n,
      originalCurrency: null,
      exchangeRateE10: null
    },
    {
      id: "tx_shared_rent",
      transactionDate: "2026-05-12T10:00:00.000Z",
      type: "expense",
      status: "validated",
      isActive: true,
      description: "Shared rent",
      categoryId: "cat_rent",
      partnerId: "partner_vendor",
      projectId: null,
      amountMinor: 30_000n,
      originalCurrency: "MUR",
      exchangeRateE10: null
    },
    {
      id: "tx_ticket_empty_currency",
      transactionDate: "2026-05-13T10:00:00.000Z",
      type: "income",
      status: "validated",
      isActive: true,
      description: "Ticket income with empty legacy currency",
      categoryId: "cat_ticket",
      partnerId: "partner_bedouin",
      projectId: "project_show",
      amountMinor: 50_000n,
      originalCurrency: "",
      exchangeRateE10: null
    },
    {
      id: "tx_stage_missing_fx",
      transactionDate: "2026-05-14T10:00:00.000Z",
      type: "expense",
      status: "validated",
      isActive: true,
      description: "Foreign expense missing FX",
      categoryId: "cat_stage",
      partnerId: "partner_bedouin",
      projectId: "project_show",
      amountMinor: 15_000n,
      originalCurrency: "EUR",
      exchangeRateE10: null
    },
    {
      id: "tx_draft_excluded",
      transactionDate: "2026-05-15T10:00:00.000Z",
      type: "income",
      status: "draft",
      isActive: true,
      description: "Draft income",
      categoryId: "cat_streaming",
      partnerId: "partner_kontor",
      projectId: "project_alma",
      amountMinor: 40_000n,
      originalCurrency: null,
      exchangeRateE10: null
    },
    {
      id: "tx_void_excluded",
      transactionDate: "2026-05-16T10:00:00.000Z",
      type: "expense",
      status: "void",
      isActive: true,
      description: "Void expense",
      categoryId: "cat_studio",
      partnerId: "partner_vendor",
      projectId: "project_alma",
      amountMinor: 6_000n,
      originalCurrency: null,
      exchangeRateE10: null
    },
    {
      id: "tx_streaming_june",
      transactionDate: "2026-06-01T10:00:00.000Z",
      type: "income",
      status: "validated",
      isActive: true,
      description: "June streaming payout",
      categoryId: "cat_streaming",
      partnerId: "partner_kontor",
      projectId: null,
      amountMinor: 20_000n,
      originalCurrency: "USD",
      exchangeRateE10: 450_000_000_000n
    }
  ],
  financialAllocations: [
    { id: "alloc_streaming_music", transactionId: "tx_streaming_usd", departmentId: "dept_music", amountMinor: 70_000n },
    { id: "alloc_streaming_office", transactionId: "tx_streaming_usd", departmentId: "dept_office", amountMinor: 30_000n },
    { id: "alloc_studio_music", transactionId: "tx_studio", departmentId: "dept_music", amountMinor: 25_000n },
    { id: "alloc_rent_office", transactionId: "tx_shared_rent", departmentId: "dept_office", amountMinor: 20_000n },
    { id: "alloc_rent_music", transactionId: "tx_shared_rent", departmentId: "dept_music", amountMinor: 10_000n },
    { id: "alloc_ticket_events", transactionId: "tx_ticket_empty_currency", departmentId: "dept_events", amountMinor: 50_000n },
    { id: "alloc_stage_events_excluded", transactionId: "tx_stage_missing_fx", departmentId: "dept_events", amountMinor: 15_000n },
    { id: "alloc_draft_excluded", transactionId: "tx_draft_excluded", departmentId: "dept_music", amountMinor: 40_000n },
    { id: "alloc_void_excluded", transactionId: "tx_void_excluded", departmentId: "dept_music", amountMinor: 6_000n },
    { id: "alloc_june_music", transactionId: "tx_streaming_june", departmentId: "dept_music", amountMinor: 20_000n }
  ]
};

test("global P&L aggregates validated ledger rows and applies FX/status filters", () => {
  assert.deepEqual(readGlobalPnl(fixture, noFilter), {
    income: "1700.00",
    expense: "550.00",
    profit: "1150.00",
    tx_count: 5,
    currency: "MUR",
    view: "global_ledger"
  });
});

test("global P&L treats a negative-signed expense amount as a positive magnitude, not a profit-inflating credit", () => {
  // Manual "New entry" transaction creation negates the amount for expense direction, while
  // bank-reconciliation and ledger-bulk-import paths store a positive magnitude and carry the
  // sign meaning in `type` alone. The aggregator must be robust to either convention: profit
  // must never be inflated by a negative-signed expense row.
  const signedExpenseDataset: OfficePnlDataset = {
    ...fixture,
    transactions: [
      {
        id: "tx_negative_signed_expense",
        transactionDate: "2026-05-20T10:00:00.000Z",
        type: "expense",
        status: "validated",
        isActive: true,
        description: "Expense stored with a negative amountMinor",
        categoryId: "cat_rent",
        partnerId: null,
        projectId: null,
        amountMinor: -12_000n,
        originalCurrency: null,
        exchangeRateE10: null
      }
    ]
  };

  assert.deepEqual(readGlobalPnl(signedExpenseDataset, noFilter), {
    income: "0.00",
    expense: "120.00",
    profit: "-120.00",
    tx_count: 1,
    currency: "MUR",
    view: "global_ledger"
  });
});

test("department P&L and by-department rows aggregate financial allocations at department grain", () => {
  assert.deepEqual(readDepartmentPnl(fixture, "dept_office", noFilter), {
    income: "300.00",
    expense: "200.00",
    profit: "100.00",
    tx_count: 2,
    currency: "MUR",
    view: "department_allocated",
    department: { id: "dept_office", name: "Office", color: "#office", type: "mixed" }
  });

  assert.deepEqual(readPnlByDepartment(fixture, noFilter), [
    { department_id: "dept_music", department_name: "Music", department_type: "mixed", income: "900.00", expense: "350.00", profit: "550.00", tx_count: 4 },
    { department_id: "dept_office", department_name: "Office", department_type: "mixed", income: "300.00", expense: "200.00", profit: "100.00", tx_count: 2 },
    { department_id: "dept_events", department_name: "Events", department_type: "mixed", income: "500.00", expense: "0.00", profit: "500.00", tx_count: 1 }
  ]);
});

test("category and division P&L derive dimensions from category division_id", () => {
  assert.deepEqual(readPnlByCategory(fixture, noFilter), [
    {
      category_id: "cat_streaming",
      category_name: "Streaming",
      category_type: "income",
      division_id: "div_music_royalties",
      division_name: "Royalties",
      department_id: "dept_music",
      department_name: "Music",
      income: "1200.00",
      expense: "0.00",
      profit: "1200.00",
      tx_count: 2
    },
    {
      category_id: "cat_studio",
      category_name: "Studio",
      category_type: "expense",
      division_id: "div_music_royalties",
      division_name: "Royalties",
      department_id: "dept_music",
      department_name: "Music",
      income: "0.00",
      expense: "250.00",
      profit: "-250.00",
      tx_count: 1
    },
    {
      category_id: "cat_rent",
      category_name: "Rent",
      category_type: "expense",
      division_id: "div_office_ops",
      division_name: "Operations",
      department_id: "dept_office",
      department_name: "Office",
      income: "0.00",
      expense: "300.00",
      profit: "-300.00",
      tx_count: 1
    },
    {
      category_id: "cat_ticket",
      category_name: "Ticket sales",
      category_type: "income",
      division_id: "div_events_live",
      division_name: "Live",
      department_id: "dept_events",
      department_name: "Events",
      income: "500.00",
      expense: "0.00",
      profit: "500.00",
      tx_count: 1
    }
  ]);

  assert.deepEqual(readPnlByDivision(fixture, noFilter), [
    { division_id: "div_music_royalties", division_name: "Royalties", department_id: "dept_music", department_name: "Music", income: "1200.00", expense: "250.00", profit: "950.00", tx_count: 3 },
    { division_id: "div_office_ops", division_name: "Operations", department_id: "dept_office", department_name: "Office", income: "0.00", expense: "300.00", profit: "-300.00", tx_count: 1 },
    { division_id: "div_events_live", division_name: "Live", department_id: "dept_events", department_name: "Events", income: "500.00", expense: "0.00", profit: "500.00", tx_count: 1 }
  ]);
});

test("category and division P&L skip validated rows whose category has no division", () => {
  const dataset: OfficePnlDataset = {
    departments: [{ id: "dept_music", name: "Music", type: "mixed", color: null, isActive: true }],
    divisions: [{ id: "div_music", departmentId: "dept_music", name: "Music", isActive: true }],
    categories: [
      { id: "cat_streaming", divisionId: "div_music", name: "Streaming", type: "income", isActive: true },
      { id: "cat_legacy_inactive", divisionId: null, name: "Legacy inactive", type: "expense", isActive: false }
    ],
    partners: [],
    projects: [],
    projectBudgetLines: [],
    transactions: [
      {
        id: "tx_streaming",
        transactionDate: "2026-05-10T10:00:00.000Z",
        type: "income",
        status: "validated",
        isActive: true,
        description: "Streaming",
        categoryId: "cat_streaming",
        partnerId: null,
        projectId: null,
        amountMinor: 100_000n,
        originalCurrency: null,
        exchangeRateE10: null
      },
      {
        id: "tx_legacy_inactive",
        transactionDate: "2026-05-11T10:00:00.000Z",
        type: "expense",
        status: "validated",
        isActive: true,
        description: "Legacy inactive",
        categoryId: "cat_legacy_inactive",
        partnerId: null,
        projectId: null,
        amountMinor: 25_000n,
        originalCurrency: null,
        exchangeRateE10: null
      }
    ],
    financialAllocations: []
  };

  assert.deepEqual(readGlobalPnl(dataset, noFilter), {
    income: "1000.00",
    expense: "250.00",
    profit: "750.00",
    tx_count: 2,
    currency: "MUR",
    view: "global_ledger"
  });
  assert.deepEqual(readPnlByCategory(dataset, noFilter), [
    {
      category_id: "cat_streaming",
      category_name: "Streaming",
      category_type: "income",
      division_id: "div_music",
      division_name: "Music",
      department_id: "dept_music",
      department_name: "Music",
      income: "1000.00",
      expense: "0.00",
      profit: "1000.00",
      tx_count: 1
    }
  ]);
  assert.deepEqual(readPnlByDivision(dataset, noFilter), [
    {
      division_id: "div_music",
      division_name: "Music",
      department_id: "dept_music",
      department_name: "Music",
      income: "1000.00",
      expense: "0.00",
      profit: "1000.00",
      tx_count: 1
    }
  ]);
});

test("project P&L fixes BUG-M1 by reading non-zero ledger totals without a department filter", () => {
  assert.deepEqual(readProjectPnl(fixture, "project_alma", noFilter), {
    income: "1000.00",
    expense: "250.00",
    profit: "750.00",
    tx_count: 2,
    currency: "MUR",
    view: "project_ledger",
    project: { id: "project_alma", name: "Alma", status: "active", state: "active" },
    budget_income: "1000.00",
    budget_expenses: "300.00"
  });

  assert.notEqual(readProjectPnl(fixture, "project_alma", noFilter).income, "0.00");
});

test("project P&L with a department filter reads allocations", () => {
  assert.deepEqual(readProjectPnl(fixture, "project_alma", musicFilter), {
    income: "700.00",
    expense: "250.00",
    profit: "450.00",
    tx_count: 2,
    currency: "MUR",
    view: "project_department_allocated",
    project: { id: "project_alma", name: "Alma", status: "active", state: "active" },
    budget_income: "1000.00",
    budget_expenses: "300.00"
  });
});

test("partner P&L fixes BUG-M1 by reading non-zero ledger totals without a department filter", () => {
  assert.deepEqual(readPartnerPnl(fixture, "partner_kontor", noFilter), {
    income: "1200.00",
    expense: "0.00",
    profit: "1200.00",
    tx_count: 2,
    currency: "MUR",
    view: "partner_ledger",
    partner: { id: "partner_kontor", name: "Kontor", type: "client" }
  });

  assert.notEqual(readPartnerPnl(fixture, "partner_kontor", noFilter).income, "0.00");
});

test("partner P&L with a department filter reads allocations", () => {
  assert.deepEqual(readPartnerPnl(fixture, "partner_kontor", musicFilter), {
    income: "900.00",
    expense: "0.00",
    profit: "900.00",
    tx_count: 2,
    currency: "MUR",
    view: "partner_department_allocated",
    partner: { id: "partner_kontor", name: "Kontor", type: "client" }
  });
});

test("monthly P&L uses ledger rows globally and allocation rows for department filters", () => {
  assert.deepEqual(readMonthlyPnl(fixture, noFilter), [
    { month: "2026-05", income: "1500.00", expense: "550.00", profit: "950.00" },
    { month: "2026-06", income: "200.00", expense: "0.00", profit: "200.00" }
  ]);

  assert.deepEqual(readMonthlyPnl(fixture, musicFilter), [
    { month: "2026-05", income: "700.00", expense: "350.00", profit: "350.00" },
    { month: "2026-06", income: "200.00", expense: "0.00", profit: "200.00" }
  ]);
});

test("inclusive date filters keep date_to through the whole day", () => {
  assert.deepEqual(readGlobalPnl(fixture, { dateFrom: "2026-06-01", dateTo: "2026-06-01", departmentId: null }), {
    income: "200.00",
    expense: "0.00",
    profit: "200.00",
    tx_count: 1,
    currency: "MUR",
    view: "global_ledger"
  });
});
