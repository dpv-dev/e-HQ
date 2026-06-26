import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { AuthenticatedApiUser, SupabaseJwtVerifier } from "../src/auth.ts";
import { createApiService, createFixtureApiService } from "../src/index.ts";
import { createFixtureStore } from "../src/fixtures.ts";
import { createDrizzlePersistenceRuntime, createMemoryPersistenceRuntime } from "../src/persistence.ts";

interface PaymentReceipt {
  readonly paymentId: string;
  readonly auditEventId: string | null;
  readonly paymentStatus: "recorded" | "edited" | "reconciled";
  readonly statementBalance: {
    readonly paymentsApplied: string;
    readonly statementBalance: string;
  };
  readonly groupTotals: readonly {
    readonly currency: string;
    readonly statementBalance: string;
  }[];
}

interface ContractRulesReceipt {
  readonly contractId: string;
  readonly auditEventId: string | null;
  readonly ruleCount: number;
  readonly totalPercentage: string;
  readonly rules: readonly {
    readonly payeeId: string;
    readonly percentage: string;
  }[];
}

interface FxRatesReceipt {
  readonly auditEventId: string | null;
  readonly rateCount: number;
  readonly rates: readonly {
    readonly fromCurrency: string;
    readonly toCurrency: string;
    readonly effectiveDate: string;
    readonly rate: string;
  }[];
}

interface IdentityLinkReceipt {
  readonly auditEventId: string | null;
  readonly officePartnerId: string;
  readonly payeeId: string;
  readonly officeLink: {
    readonly partnerId: string;
    readonly payeeId: string | null;
    readonly resolution: string;
    readonly source: string;
    readonly confidence: string | null;
  };
  readonly distributionLink: {
    readonly payeeId: string;
    readonly officePartnerId: string | null;
    readonly linked: boolean;
    readonly confidence: string | null;
  };
}

test("Office dashboard and global P&L are served from the domain read layer", async () => {
  const app = createFixtureApiService();

  const dashboardResponse = await app.request("/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.cashBalanceMicro, "3000.00");
  assert.equal(dashboard.unreconciledTransactionCount, 1);

  const pnlResponse = await app.request("/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(pnlResponse.status, 200);
  const pnl = await pnlResponse.json();
  assert.equal(pnl.incomeMicro, "5000.00");
  assert.equal(pnl.expenseMicro, "1250.00");
  assert.equal(pnl.netMicro, "3750.00");
  assert.equal(pnl.completeness, "complete");
});

test("Business routes require Supabase bearer auth and auth/me returns the verified identity", async () => {
  const app = createFixtureApiService();

  const unauthorized = await app.request("/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02");
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: "unauthorized" });

  const me = await app.request("/auth/me", {
    headers: authHeaders()
  });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    userId: "user_fixture",
    email: "fixture@eeee.mu",
    role: "administrator",
    workspaceId: "eeee-mu"
  });
});

test("API responds with CORS headers for the HQ origin", async () => {
  const app = createFixtureApiService();

  const response = await app.request("/healthz", {
    headers: {
      Origin: "https://app.eeee.mu"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.eeee.mu");

  const preflight = await app.request("/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02", {
    method: "OPTIONS",
    headers: {
      Origin: "https://app.eeee.mu",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Content-Type, Authorization"
    }
  });

  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://app.eeee.mu");
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /GET/);
});

test("Bot roles are scoped to their own workspace write doors", async () => {
  const app = createDisabledFixtureApiService();
  const bankPreviewBody = {
    workspaceId: "eeee-mu",
    source: "csv",
    fileName: "sophie-smoke.csv",
    checksum: "sophie-smoke",
    rows: []
  };

  const officeAllowed = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-bot-office-token"), "Content-Type": "application/json" },
    body: JSON.stringify(bankPreviewBody)
  });
  assert.equal(officeAllowed.status, 200);

  const officeCrossWorkspace = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-bot-office-token"), "Content-Type": "application/json" },
    body: JSON.stringify({ ...bankPreviewBody, workspaceId: "other-workspace" })
  });
  assert.equal(officeCrossWorkspace.status, 403);
  assert.equal((await officeCrossWorkspace.json()).error.code, "bot_workspace_denied");

  const distributionCannotOffice = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-bot-distribution-token"), "Content-Type": "application/json" },
    body: JSON.stringify(bankPreviewBody)
  });
  assert.equal(distributionCannotOffice.status, 403);
  assert.equal((await distributionCannotOffice.json()).error.code, "bot_permission_denied");
});

test("Distribution bot can only reach guarded Distribution write doors and cannot read settings", async () => {
  const app = createDisabledFixtureApiService();
  const contractBody = {
    workspaceId: "eeee-mu",
    id: null,
    payeeId: null,
    title: "Codex bot door",
    status: "draft",
    effectiveFrom: "2026-06-26",
    effectiveTo: null,
    splitBp: 0,
    currency: "EUR"
  };

  const catalogDoor = await app.request("/erh/v1/contracts", {
    method: "POST",
    headers: {
      ...authHeadersForToken("fixture-bot-distribution-token"),
      "Content-Type": "application/json",
      "Idempotency-Key": "bot-contract-door"
    },
    body: JSON.stringify(contractBody)
  });
  assert.equal(catalogDoor.status, 501);
  assert.equal((await catalogDoor.json()).error, "action_not_enabled_yet");

  const officeCannotDistribution = await app.request("/erh/v1/contracts", {
    method: "POST",
    headers: {
      ...authHeadersForToken("fixture-bot-office-token"),
      "Content-Type": "application/json",
      "Idempotency-Key": "bot-office-contract-door"
    },
    body: JSON.stringify(contractBody)
  });
  assert.equal(officeCannotDistribution.status, 403);
  assert.equal((await officeCannotDistribution.json()).error.code, "bot_permission_denied");

  const settings = await app.request("/erh/v1/settings?workspaceId=eeee-mu", {
    headers: authHeadersForToken("fixture-bot-distribution-token")
  });
  assert.equal(settings.status, 403);
  assert.equal((await settings.json()).error.code, "bot_route_denied");
});

test("Office dashboard tolerates a missing runway month and still returns 200", async () => {
  const fixture = createFixtureStore();
  const remappedOffice = {
    ...fixture.office,
    transactions: fixture.office.transactions.map((transaction) => ({
      ...transaction,
      transactionDate: transaction.transactionDate.startsWith("2026-02")
        ? transaction.transactionDate.replace("2026-02", "2026-03")
        : transaction.transactionDate
    }))
  };
  const app = createApiService({
    fixtures: {
      ...fixture,
      office: remappedOffice
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const response = await app.request("/eof/v1/dashboard?workspaceId=workspace_1&period=2026-05", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const dashboard = await response.json();
  assert.equal(dashboard.period, "2026-05");
  assert.equal(dashboard.cashBalanceMicro, "3000.00");
});

test("Office transactions expose category-derived path and keep project nullable", async () => {
  const app = createFixtureApiService();

  const response = await app.request("/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&limit=10", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const page = await response.json();
  const fee = page.items.find((item: { readonly id: string }) => item.id === "tx_mcb_fee");
  const pending = page.items.find((item: { readonly id: string }) => item.id === "tx_uncategorized");

  assert.equal(fee.departmentLabel, "Operations");
  assert.equal(fee.divisionLabel, "Administration");
  assert.equal(fee.categoryLabel, "Bank fees");
  assert.equal(fee.type, "expense");
  assert.equal(fee.projectId, null);
  assert.equal(fee.projectLabel, null);

  assert.equal(pending.status, "pending");
  assert.equal(pending.categoryId, null);
  assert.equal(pending.projectId, null);
});

test("Office partner facets are lenses over the same partner", async () => {
  const app = createFixtureApiService();

  const clientResponse = await app.request("/eof/v1/partners?workspaceId=workspace_1&period=2026-02&facet=client&limit=10", {
    headers: authHeaders()
  });
  const supplierResponse = await app.request("/eof/v1/partners?workspaceId=workspace_1&period=2026-02&facet=supplier&limit=10", {
    headers: authHeaders()
  });
  assert.equal(clientResponse.status, 200);
  assert.equal(supplierResponse.status, 200);

  const clients = await clientResponse.json();
  const suppliers = await supplierResponse.json();
  assert.ok(clients.items.some((item: { readonly id: string }) => item.id === "partner_bedouin"));
  assert.ok(suppliers.items.some((item: { readonly id: string }) => item.id === "partner_bedouin"));

  const detailResponse = await app.request("/eof/v1/pl/partner/partner_bedouin?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.activity.income.periodTotalMicro, "5000.00");
  assert.equal(detail.activity.expense.periodTotalMicro, "1200.00");
  assert.equal(detail.activity.netMicro, "3800.00");
  assert.equal(detail.distributionPayeeLink.payeeId, "payee_alma");
});

test("Distribution reads migrated royalty results as fixture checksums, not recalculation", async () => {
  const app = createFixtureApiService();

  const dashboardResponse = await app.request("/erh/v1/dashboard?workspaceId=workspace_1&period=2026-04", {
    headers: authHeaders()
  });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.grossRoyaltyMicro, "100.0000000000");
  assert.equal(dashboard.recoupedMicro, "10.0000000000");
  assert.equal(dashboard.netPayableMicro, "90.0000000000");
  assert.equal(dashboard.suspenseCount, 1);

  const statementsResponse = await app.request("/erh/v1/statements?workspaceId=workspace_1&period=2026-04&limit=10", {
    headers: authHeaders()
  });
  assert.equal(statementsResponse.status, 200);
  const statements = await statementsResponse.json();
  assert.equal(statements.items[0].grossMicro, "70.0000000000");
  assert.equal(statements.items[0].paidMicro, "15.1000000000");
  assert.equal(statements.items[0].netPayableMicro, "44.9000000000");
});

test("Bank accounts expose source labels and workspace fallback resolves eeee-mu", async () => {
  const fixture = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixture,
      office: {
        ...fixture.office,
        bankAccounts: fixture.office.bankAccounts.map((account) => ({
          ...account,
          workspaceId: "eeee-mu"
        }))
      }
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const response = await app.request("/eof/v1/bank/accounts?limit=10", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const page = (await response.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly workspaceId: string;
      readonly bankName?: string;
      readonly accountLabel?: string;
      readonly currentBalanceMicro: string;
    }[];
  };
  const account = page.items.find((item) => item.id === "bank_mur");
  assert.equal(account?.workspaceId, "eeee-mu");
  assert.equal(account?.bankName, "Mauritius Commercial Bank");
  assert.equal(account?.accountLabel, "MCB MUR");
  assert.equal(account?.currentBalanceMicro, "2500.00");
});

test("Statements list keeps scale-10 money and includes full period range", async () => {
  const fixture = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixture,
      distribution: {
        ...fixture.distribution,
        statements: [
          ...fixture.distribution.statements,
          {
            id: "statement_annual_2025",
            payeeId: "payee_alma",
            calculationRunId: "run_1",
            periodStart: "2025-01-01",
            periodEnd: "2025-12-31",
            currency: "EUR",
            grossTotal: "123.4500000000",
            recoupmentTotal: "23.4500000000",
            netPayable: "100.0000000000",
            amountDue: "100.0000000000",
            version: 1,
            status: "generated",
            createdAt: "2026-01-02T10:00:00.000Z"
          }
        ]
      }
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const response = await app.request("/erh/v1/statements?workspaceId=workspace_1&limit=10", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const page = (await response.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly period: string;
      readonly period_start: string;
      readonly period_end: string;
      readonly grossMicro: string;
      readonly recoupedMicro: string;
      readonly paidMicro: string;
      readonly netPayableMicro: string;
      readonly currency: string;
    }[];
  };
  const annual = page.items.find((item) => item.id === "statement_annual_2025");
  assert.equal(annual?.period, "2025-01");
  assert.equal(annual?.period_start, "2025-01-01");
  assert.equal(annual?.period_end, "2025-12-31");
  assert.equal(annual?.grossMicro, "123.4500000000");
  assert.equal(annual?.recoupedMicro, "23.4500000000");
  assert.equal(annual?.paidMicro, "0.0000000000");
  assert.equal(annual?.netPayableMicro, "100.0000000000");
  assert.equal(annual?.currency, "EUR");

  const fixtureStatement = page.items.find((item) => item.id === "statement_alma");
  assert.equal(fixtureStatement?.netPayableMicro, "44.9000000000");
});

test("write routes require Idempotency-Key and are explicitly disabled in preview mode", async () => {
  const app = createFixtureApiService();
  const body = JSON.stringify({
    workspaceId: "workspace_1",
    occurredOn: "2026-02-20",
    accountId: "bank_mur",
    categoryId: "cat_bank_fee",
    projectId: null,
    description: "Fixture write",
    amountMicro: "10.00",
    currency: "MUR"
  });

  const missingKey = await app.request("/eof/v1/transactions", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body
  });
  assert.equal(missingKey.status, 400);
  const missingJson = (await missingKey.json()) as { readonly error: { readonly code: string } };
  assert.equal(missingJson.error.code, "idempotency_key_required");

  const accepted = await app.request("/eof/v1/transactions", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "test-write-1" },
    body
  });
  assert.equal(accepted.status, 501);
  const disabled = (await accepted.json()) as { readonly error: string; readonly message: string; readonly action: string };
  assert.equal(disabled.error, "action_not_enabled_yet");
  assert.ok(disabled.message.includes("not enabled yet"));
  assert.equal(disabled.action, "office_transaction_create");
});

test("formerly disabled write routes are activated with receipts and audit ids", async () => {
  const fixtures = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixtures,
      distributionMappingRows: [
        {
          id: "earning_suspense",
          batchId: "batch_kontor",
          sourceTitle: "Unknown",
          sourceArtist: "Unknown",
          sourceStore: "Apple Music",
          suggestedTrackId: "track_1",
          suggestedTrackTitle: "Seggae light",
          confidenceBp: 9600,
          status: "suggested",
          exactFixPath: "mapping_rules"
        }
      ]
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const transactionCreate = await jsonWrite(app, "/eof/v1/transactions", "POST", "activated-transaction-create", {
    workspaceId: "workspace_1",
    occurredOn: "2026-02-20",
    accountId: "bank_mur",
    categoryId: "cat_bank_fee",
    projectId: null,
    description: "Activated transaction",
    amountMicro: "12.34",
    currency: "MUR"
  });
  assertReceipt(transactionCreate);
  const transactionReplay = await jsonWrite(app, "/eof/v1/transactions", "POST", "activated-transaction-create", {
    workspaceId: "workspace_1",
    occurredOn: "2026-02-20",
    accountId: "bank_mur",
    categoryId: "cat_bank_fee",
    projectId: null,
    description: "Activated transaction",
    amountMicro: "12.34",
    currency: "MUR"
  });
  assert.equal(transactionReplay.id, transactionCreate.id);

  assertReceipt(await jsonWrite(app, `/eof/v1/transactions/${transactionCreate.id}`, "PATCH", "activated-transaction-update", {
    workspaceId: "workspace_1",
    occurredOn: "2026-02-21",
    accountId: "bank_mur",
    categoryId: "cat_bank_fee",
    projectId: null,
    description: "Activated transaction updated",
    amountMicro: "12.34",
    currency: "MUR"
  }));

  const nodeCreate = await jsonWrite(app, "/eof/v1/plan-comptable", "POST", "activated-plan-create", {
    workspaceId: "workspace_1",
    parentId: "div_admin",
    kind: "category",
    code: "ACT",
    label: "Activated category",
    active: true,
    type: "expense"
  });
  assertReceipt(nodeCreate);
  assertReceipt(await jsonWrite(app, `/eof/v1/plan-comptable/${nodeCreate.id}`, "PATCH", "activated-plan-update", {
    workspaceId: "workspace_1",
    parentId: "div_admin",
    kind: "category",
    code: "ACT",
    label: "Activated category updated",
    active: true,
    type: "expense"
  }));

  const reconciliationPage = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1&limit=10", {
    headers: authHeaders()
  });
  assert.equal(reconciliationPage.status, 200);
  const reconciliations = (await reconciliationPage.json()) as { readonly items: readonly { readonly id: string }[] };
  assert.ok(reconciliations.items[0] !== undefined);
  assertReceipt(await jsonWrite(app, "/eof/v1/reconciliations/approve", "POST", "activated-reconciliation-approve", {
    workspaceId: "workspace_1",
    reconciliationIds: [reconciliations.items[0].id],
    approvedAt: "2026-06-21T00:00:00.000Z"
  }));

  const partnerCreate = await jsonWrite(app, "/eof/v1/partners", "POST", "activated-partner-create", {
    workspaceId: "workspace_1",
    name: "Activated Partner",
    email: null,
    phone: null,
    address: null,
    taxId: null,
    notes: null,
    active: true
  });
  assertReceipt(partnerCreate);
  assertReceipt(await jsonWrite(app, `/eof/v1/partners/${partnerCreate.id}`, "PATCH", "activated-partner-update", {
    workspaceId: "workspace_1",
    name: "Activated Partner Updated",
    email: null,
    phone: null,
    address: null,
    taxId: null,
    notes: null,
    active: true
  }));
  assertReceipt(await jsonWrite(app, "/eof/v1/partners/partner_mcb/payee-link", "PATCH", "activated-partner-payee-unlink", {
    workspaceId: "workspace_1",
    payeeId: null
  }));

  assertReceipt(await jsonWrite(app, "/erh/v1/mapping/apply-rules", "POST", "activated-mapping-apply", {
    workspaceId: "workspace_1",
    batchId: "batch_kontor",
    rowIds: ["earning_suspense"]
  }));
  assertReceipt(await jsonWrite(app, "/erh/v1/contracts/contract_1/expenses", "POST", "activated-contract-expense", {
    workspaceId: "workspace_1",
    contractId: "contract_1",
    payeeId: "payee_alma",
    incurredOn: "2026-05-18",
    label: "Activated expense",
    amountMicro: "1.0000000000",
    currency: "USD"
  }));
  assertReceipt(await jsonWrite(app, "/erh/v1/allocations/runs/run_1/unpost", "POST", "activated-allocation-unpost", {
    workspaceId: "workspace_1",
    reason: "Activated test",
    lockToken: "test-lock"
  }));
  assertReceipt(await jsonWrite(app, "/erh/v1/suspense/suspense_1/resolve", "POST", "activated-suspense-resolve", {
    workspaceId: "workspace_1",
    suspenseId: "suspense_1",
    resolution: "map_to_track",
    targetId: "track_1",
    note: "Activated test"
  }));

  const viewerDenied = await app.request("/erh/v1/allocations/runs/run_1/unpost", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-viewer-token"), "Content-Type": "application/json", "Idempotency-Key": "activated-viewer-denied" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      reason: "Viewer denied",
      lockToken: "viewer-lock"
    })
  });
  assert.equal(viewerDenied.status, 403);
});

test("allocation preview is dry-run and allocation run stays disabled when writes are off", async () => {
  const app = createDisabledFixtureApiService();
  const response = await app.request("/erh/v1/allocations/runs/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:2026-04"
    })
  });

  assert.equal(response.status, 200);
  const preview = (await response.json()) as { readonly allocationCount: number; readonly expenseApplicationCount: number; readonly suspenseCount: number };
  assert.equal(preview.allocationCount, 2);
  assert.equal(preview.expenseApplicationCount, 1);
  assert.equal(preview.suspenseCount, 0);

  const runDisabled = await app.request("/erh/v1/allocations/runs", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:2026-04",
      cadence: "manual"
    })
  });

  assert.equal(runDisabled.status, 501);
  const disabled = (await runDisabled.json()) as { readonly error: string; readonly message: string; readonly action: string };
  assert.equal(disabled.error, "action_not_enabled_yet");
  assert.equal(disabled.action, "distribution_allocations_run");
  assert.ok(disabled.message.includes("not enabled yet"));
});

test("allocation preview denies non-admin users", async () => {
  const app = createDisabledFixtureApiService();
  const response = await app.request("/erh/v1/allocations/runs/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-viewer-token"), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:2026-04"
    })
  });

  assert.equal(response.status, 403);
});

test("allocation run persists engine plan once and exposes allocations read-after-write", async () => {
  const app = createWriteEnabledFixtureApiService();
  const runBody = {
    workspaceId: "workspace_1",
    period: "2026-04",
    lockKey: "distribution:allocation:2026-04",
    cadence: "manual"
  };

  const response = await app.request("/erh/v1/allocations/runs", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-real-1" },
    body: JSON.stringify(runBody)
  });

  assert.equal(response.status, 200);
  const receipt = (await response.json()) as { readonly runId: string; readonly auditEventId: string | null; readonly allocationCount: number; readonly expenseApplicationCount: number; readonly suspenseCount: number };
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.allocationCount, 2);
  assert.equal(receipt.expenseApplicationCount, 1);
  assert.equal(receipt.suspenseCount, 0);

  const replay = await app.request("/erh/v1/allocations/runs", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-real-1" },
    body: JSON.stringify(runBody)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as { readonly runId: string };
  assert.equal(replayReceipt.runId, receipt.runId);

  const allocations = await app.request(`/erh/v1/allocations?workspaceId=workspace_1&runId=${receipt.runId}&limit=10`, {
    headers: authHeaders()
  });
  assert.equal(allocations.status, 200);
  const allocationsPage = (await allocations.json()) as { readonly items: readonly { readonly earningId: string; readonly netPayable: string }[] };
  assert.equal(allocationsPage.items.length, 2);
  assert.ok(allocationsPage.items.every((item) => item.earningId === "earning_pending"));
});

test("invalid royalty split goes to suspense and is never allocated", async () => {
  const app = createWriteEnabledFixtureApiServiceWithOverrides({
    distributionRoyaltyRules: [
      {
        contractId: "contract_1",
        royaltyRuleId: "rule_invalid",
        payeeId: "payee_alma",
        artistId: "artist_alma",
        role: "artist",
        percentage: "99.999999",
        scopeType: null,
        scopeId: null,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        status: "active"
      }
    ]
  });

  const response = await app.request("/erh/v1/allocations/runs", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-invalid-split-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:invalid-split",
      cadence: "manual"
    })
  });

  assert.equal(response.status, 200);
  const receipt = (await response.json()) as { readonly runId: string; readonly allocationCount: number; readonly suspenseCount: number; readonly suspenseItems: readonly { readonly reasonCode: string }[] };
  assert.equal(receipt.allocationCount, 0);
  assert.equal(receipt.suspenseCount, 1);
  assert.equal(receipt.suspenseItems[0]?.reasonCode, "invalid_split");

  const allocations = await app.request(`/erh/v1/allocations?workspaceId=workspace_1&runId=${receipt.runId}&limit=10`, {
    headers: authHeaders()
  });
  assert.equal(allocations.status, 200);
  const allocationsPage = (await allocations.json()) as { readonly items: readonly unknown[] };
  assert.equal(allocationsPage.items.length, 0);

  const suspense = await app.request("/erh/v1/suspense?workspaceId=workspace_1&status=open&limit=20", {
    headers: authHeaders()
  });
  assert.equal(suspense.status, 200);
  const suspensePage = (await suspense.json()) as { readonly items: readonly { readonly amountMicro: string; readonly sourceReference: string }[] };
  assert.ok(suspensePage.items.some((item) => item.amountMicro === "100.0000000000" && item.sourceReference === "MUAAA2600001"));
});

test("allocation run writes calculation, allocations, expense applications, cost updates, and audit in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteAllocationTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const response = await app.request("/erh/v1/allocations/runs", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        period: "2026-04",
        lockKey: "distribution:allocation:pglite",
        cadence: "manual"
      })
    });
    assert.equal(response.status, 200);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "calculation_runs"), 1);
    assert.equal(await pgliteCount(pglite, "earning_allocations"), 2);
    assert.equal(await pgliteCount(pglite, "expense_applications"), 1);
    assert.equal(await pgliteCount(pglite, "suspense_items"), 0);

    const costTerm = await pglite.query("select status from contract_cost_terms where id = 'cost_advance'");
    assert.equal((costTerm.rows[0] as { readonly status: string }).status, "recovered");
  } finally {
    await pglite.close();
  }
});

test("allocation invalid split writes suspense but no allocations in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteAllocationTables(pglite);
  const app = createApiService({
    fixtures: {
      ...createFixtureStore(),
      distributionRoyaltyRules: [
        {
          contractId: "contract_1",
          royaltyRuleId: "rule_invalid",
          payeeId: "payee_alma",
          artistId: "artist_alma",
          role: "artist",
          percentage: "99.999999",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          status: "active"
        }
      ]
    },
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const response = await app.request("/erh/v1/allocations/runs", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-pglite-invalid-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        period: "2026-04",
        lockKey: "distribution:allocation:pglite-invalid",
        cadence: "manual"
      })
    });
    assert.equal(response.status, 200);
    assert.equal(await pgliteCount(pglite, "calculation_runs"), 1);
    assert.equal(await pgliteCount(pglite, "earning_allocations"), 0);
    assert.equal(await pgliteCount(pglite, "suspense_items"), 1);
  } finally {
    await pglite.close();
  }
});

test("allocation run rolls back atomically when persistence fails", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteAllocationTables(pglite);
  await pglite.exec("drop table earning_allocations");
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const response = await app.request("/erh/v1/allocations/runs", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "alloc-run-rollback-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        period: "2026-04",
        lockKey: "distribution:allocation:rollback",
        cadence: "manual"
      })
    });
    assert.equal(response.status, 500);
    assert.equal(await pgliteCount(pglite, "calculation_runs"), 0);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 0);
  } finally {
    await pglite.close();
  }
});

test("statement generation applies computeCarry invariants and is idempotent", async () => {
  const app = createWriteEnabledFixtureApiServiceWithOverrides({
    distributionPayeeBalances: [
      {
        id: "balance_alma_prior_negative",
        payeeId: "payee_alma",
        statementId: null,
        currency: "USD",
        openingBalance: "0.0000000000",
        periodNet: "-50.0000000000",
        closingBalance: "-50.0000000000",
        movementType: "statement",
        createdAt: "2026-06-01T00:00:00.000Z"
      },
      {
        id: "balance_david_prior_negative",
        payeeId: "payee_david",
        statementId: null,
        currency: "USD",
        openingBalance: "0.0000000000",
        periodNet: "-50.0000000000",
        closingBalance: "-50.0000000000",
        movementType: "statement",
        createdAt: "2026-06-01T00:00:00.000Z"
      }
    ]
  });
  const request = {
    workspaceId: "workspace_1",
    period: "2026-05",
    payeeIds: ["payee_alma", "payee_david"],
    lockKey: "distribution:statement:2026-05"
  };

  const response = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-carry-1" },
    body: JSON.stringify(request)
  });
  assert.equal(response.status, 200);
  const receipt = (await response.json()) as {
    readonly runId: string;
    readonly statementCount: number;
    readonly statements: readonly { readonly payeeId: string; readonly amountDue: string; readonly closingBalance: string }[];
  };
  assert.equal(receipt.statementCount, 2);
  assert.deepEqual(
    receipt.statements.map((statement) => ({ payeeId: statement.payeeId, amountDue: statement.amountDue, closingBalance: statement.closingBalance })),
    [
      { payeeId: "payee_alma", amountDue: "10.0000000000", closingBalance: "0.0000000000" },
      { payeeId: "payee_david", amountDue: "0.0000000000", closingBalance: "-20.0000000000" }
    ]
  );

  const replay = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-carry-1" },
    body: JSON.stringify(request)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as { readonly runId: string };
  assert.equal(replayReceipt.runId, receipt.runId);
});

test("statement generation lock/conflict prevents duplicate live statements", async () => {
  const app = createWriteEnabledFixtureApiService();
  const request = {
    workspaceId: "workspace_1",
    period: "2026-06",
    payeeIds: ["payee_david"],
    lockKey: "distribution:statement:payee_david:2026-06:USD"
  };

  const first = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-dupe-1" },
    body: JSON.stringify(request)
  });
  assert.equal(first.status, 200);

  const second = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-dupe-2" },
    body: JSON.stringify(request)
  });
  assert.equal(second.status, 409);

  const statements = await app.request("/erh/v1/statements?workspaceId=workspace_1&period=2026-06&payeeId=payee_david&limit=10", {
    headers: authHeaders()
  });
  assert.equal(statements.status, 200);
  const page = (await statements.json()) as { readonly items: readonly { readonly payeeId: string; readonly period: string }[] };
  assert.equal(page.items.length, 1);
});

test("statement generation is honestly disabled when writes are off", async () => {
  const app = createDisabledFixtureApiService();
  const response = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-05",
      payeeIds: ["payee_david"],
      lockKey: "distribution:statement:disabled"
    })
  });
  assert.equal(response.status, 501);
  const disabled = (await response.json()) as { readonly error: string; readonly action: string };
  assert.equal(disabled.error, "action_not_enabled_yet");
  assert.equal(disabled.action, "distribution_statement_generate");
});

test("statement void appends a reversal and never deletes the original balance", async () => {
  const app = createWriteEnabledFixtureApiService();
  const generate = await app.request("/erh/v1/statements/generate", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-void-generate-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-07",
      payeeIds: ["payee_david"],
      lockKey: "distribution:statement:void-memory"
    })
  });
  assert.equal(generate.status, 200);
  const generated = (await generate.json()) as { readonly statements: readonly { readonly id: string }[] };
  const statementId = generated.statements[0]?.id;
  assert.ok(statementId !== undefined);

  const voided = await app.request(`/erh/v1/statements/${statementId}/void`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-void-1" },
    body: JSON.stringify({ workspaceId: "workspace_1", reason: "test void" })
  });
  assert.equal(voided.status, 200);
  const receipt = (await voided.json()) as { readonly reversalLedgerRowCount: number; readonly reversal: { readonly movementType: string; readonly statementId: string | null } };
  assert.equal(receipt.reversalLedgerRowCount, 1);
  assert.equal(receipt.reversal.movementType, "void_reversal");
  assert.equal(receipt.reversal.statementId, statementId);

  const secondVoid = await app.request(`/erh/v1/statements/${statementId}/void`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-void-2" },
    body: JSON.stringify({ workspaceId: "workspace_1", reason: "test void again" })
  });
  assert.equal(secondVoid.status, 409);
});

test("statement generation and void persist statements, lines, and append-only balances in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteStatementTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const generate = await app.request("/erh/v1/statements/generate", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        period: "2026-08",
        payeeIds: ["payee_david"],
        lockKey: "distribution:statement:pglite"
      })
    });
    assert.equal(generate.status, 200);
    const generated = (await generate.json()) as { readonly statements: readonly { readonly id: string }[] };
    const statementId = generated.statements[0]?.id;
    assert.ok(statementId !== undefined);
    assert.equal(await pgliteCount(pglite, "statements"), 1);
    assert.equal(await pgliteCount(pglite, "statement_lines"), 1);
    assert.equal(await pgliteCount(pglite, "payee_balances"), 1);

    const duplicate = await app.request("/erh/v1/statements/generate", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-generate-pglite-2" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        period: "2026-08",
        payeeIds: ["payee_david"],
        lockKey: "distribution:statement:pglite"
      })
    });
    assert.equal(duplicate.status, 409);
    assert.equal(await pgliteCount(pglite, "statements"), 1);

    const voided = await app.request(`/erh/v1/statements/${statementId}/void`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "statement-void-pglite-1" },
      body: JSON.stringify({ workspaceId: "workspace_1", reason: "pglite void" })
    });
    assert.equal(voided.status, 200);
    assert.equal(await pgliteCount(pglite, "statements"), 1);
    assert.equal(await pgliteCount(pglite, "statement_lines"), 1);
    assert.equal(await pgliteCount(pglite, "payee_balances"), 2);
    const status = await pglite.query("select status from statements where id = $1", [statementId]);
    assert.equal((status.rows[0] as { readonly status: string }).status, "void");
  } finally {
    await pglite.close();
  }
});

test("payment record is honestly disabled when writes are off", async () => {
  const app = createDisabledFixtureApiService();
  const response = await app.request("/erh/v1/payments", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      statementId: "statement_alma",
      payeeId: "payee_alma",
      amountMicro: "0.0000000001",
      currency: "USD",
      paidAt: "2026-06-21T10:00:00.000Z",
      reference: "PAY-DISABLED"
    })
  });

  assert.equal(response.status, 501);
  const disabled = (await response.json()) as { readonly error: string; readonly action: string };
  assert.equal(disabled.error, "action_not_enabled_yet");
  assert.equal(disabled.action, "distribution_payment_record");
});

test("payment record, update, and reconcile recompute balances exactly and read after write", async () => {
  const app = createWriteEnabledFixtureApiService();
  const recordBody = {
    workspaceId: "workspace_1",
    statementId: "statement_alma",
    payeeId: "payee_alma",
    amountMicro: "0.0000000001",
    currency: "USD",
    paidAt: "2026-06-21T10:00:00.000Z",
    reference: "PAY-DRIFT"
  };

  const record = await app.request("/erh/v1/payments", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-memory-1" },
    body: JSON.stringify(recordBody)
  });
  assert.equal(record.status, 200);
  const receipt = (await record.json()) as PaymentReceipt;
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.statementBalance.paymentsApplied, "15.1000000001");
  assert.equal(receipt.statementBalance.statementBalance, "44.8999999999");
  assert.equal(receipt.groupTotals.find((total) => total.currency === "USD")?.statementBalance, "44.8999999999");

  const replay = await app.request("/erh/v1/payments", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-memory-1" },
    body: JSON.stringify(recordBody)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as PaymentReceipt;
  assert.equal(replayReceipt.paymentId, receipt.paymentId);

  const update = await app.request(`/erh/v1/payments/${receipt.paymentId}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-update-memory-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      amountMicro: "0.1000000001",
      currency: "USD",
      reference: "PAY-DRIFT-EDITED"
    })
  });
  assert.equal(update.status, 200);
  const updated = (await update.json()) as PaymentReceipt;
  assert.equal(updated.statementBalance.paymentsApplied, "15.2000000001");
  assert.equal(updated.statementBalance.statementBalance, "44.7999999999");

  const reconcile = await app.request(`/erh/v1/payments/${receipt.paymentId}/reconcile`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-reconcile-memory-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      bankTransactionId: "bank_tx_1",
      reconciledAt: "2026-06-21T11:00:00.000Z"
    })
  });
  assert.equal(reconcile.status, 200);
  const reconciled = (await reconcile.json()) as PaymentReceipt;
  assert.equal(reconciled.paymentStatus, "reconciled");
  assert.equal(reconciled.statementBalance.statementBalance, "44.7999999999");

  const statements = await app.request("/erh/v1/statements?workspaceId=workspace_1&period=2026-04&payeeId=payee_alma&limit=10", {
    headers: authHeaders()
  });
  assert.equal(statements.status, 200);
  const statementPage = (await statements.json()) as { readonly items: readonly { readonly id: string; readonly paidMicro: string; readonly netPayableMicro: string }[] };
  const statement = statementPage.items.find((item) => item.id === "statement_alma");
  assert.equal(statement?.paidMicro, "15.2000000001");
  assert.equal(statement?.netPayableMicro, "44.7999999999");

  const payments = await app.request("/erh/v1/payments?workspaceId=workspace_1&payeeId=payee_alma&limit=10", {
    headers: authHeaders()
  });
  assert.equal(payments.status, 200);
  const paymentPage = (await payments.json()) as { readonly items: readonly { readonly id: string; readonly amountMicro: string; readonly status: string; readonly reference: string | null }[] };
  const payment = paymentPage.items.find((item) => item.id === receipt.paymentId);
  assert.equal(payment?.id, receipt.paymentId);
  assert.equal(payment?.amountMicro, "0.1000000001");
  assert.equal(payment?.status, "paid");
  assert.equal(payment?.reference, "PAY-DRIFT-EDITED");
  assert.equal(paymentPage.items.filter((item) => item.id === receipt.paymentId).length, 1);
});

test("payment writes persist, replay idempotently, reconcile, audit, and rollback in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPglitePaymentTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const recordBody = {
      workspaceId: "workspace_1",
      statementId: "statement_alma",
      payeeId: "payee_alma",
      amountMicro: "0.1000000001",
      currency: "USD",
      paidAt: "2026-06-21T10:00:00.000Z",
      reference: "PAY-PGLITE"
    };
    const record = await app.request("/erh/v1/payments", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-pglite-1" },
      body: JSON.stringify(recordBody)
    });
    assert.equal(record.status, 200);
    const receipt = (await record.json()) as PaymentReceipt;
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "payments"), 1);
    assert.equal(await pgliteCount(pglite, "statement_payment_links"), 1);

    const replay = await app.request("/erh/v1/payments", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-pglite-1" },
      body: JSON.stringify(recordBody)
    });
    assert.equal(replay.status, 200);
    assert.equal(await pgliteCount(pglite, "payments"), 1);
    assert.equal(await pgliteCount(pglite, "statement_payment_links"), 1);

    const update = await app.request(`/erh/v1/payments/${receipt.paymentId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-update-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        amountMicro: "0.2000000001",
        currency: "USD",
        reference: "PAY-PGLITE-EDITED"
      })
    });
    assert.equal(update.status, 200);
    const amount = await pglite.query("select amount::text as amount from payments where id = $1", [receipt.paymentId]);
    assert.equal((amount.rows[0] as { readonly amount: string }).amount, "0.2000000001");
    assert.equal(await pgliteCount(pglite, "payments"), 1);
    assert.equal(await pgliteCount(pglite, "statement_payment_links"), 1);

    const reconcile = await app.request(`/erh/v1/payments/${receipt.paymentId}/reconcile`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-reconcile-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        bankTransactionId: "bank_tx_pglite",
        reconciledAt: "2026-06-21T11:00:00.000Z"
      })
    });
    assert.equal(reconcile.status, 200);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 3);
    const status = await pglite.query("select status from payments where id = $1", [receipt.paymentId]);
    assert.equal((status.rows[0] as { readonly status: string }).status, "reconciled");
  } finally {
    await pglite.close();
  }
});

test("payment record rolls back atomically when link persistence fails", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPglitePaymentTables(pglite);
  await pglite.exec("drop table statement_payment_links");
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const response = await app.request("/erh/v1/payments", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-record-rollback-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        statementId: "statement_alma",
        payeeId: "payee_alma",
        amountMicro: "1.0000000000",
        currency: "USD",
        paidAt: "2026-06-21T10:00:00.000Z",
        reference: "PAY-ROLLBACK"
      })
    });
    assert.equal(response.status, 500);
    assert.equal(await pgliteCount(pglite, "payments"), 0);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 0);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 0);
  } finally {
    await pglite.close();
  }
});

test("payment mutation code does not call external transfer providers", async () => {
  const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  const persistenceSource = await readFile(new URL("../src/persistence.ts", import.meta.url), "utf8");
  const source = [
    sourceBetween(indexSource, "async function distributionPaymentRecordResponse", "async function distributionImportPreviewResponse"),
    sourceBetween(persistenceSource, "export async function persistDistributionPaymentRecord", "export async function markDistributionImportBatchVoid")
  ].join("\n");

  assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|stripe|payout|transfer|transferFunds|createTransfer)\b/iu);
});

test("contract royalty rules reject a non-exact scale-6 split with 422 and do not change allocation input", async () => {
  const app = createWriteEnabledFixtureApiService();
  const response = await app.request("/erh/v1/contracts/contract_1/rules", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-invalid-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      rules: [
        {
          payeeId: "payee_alma",
          percentage: "70.000000",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null
        },
        {
          payeeId: "payee_david",
          percentage: "29.999999",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null
        }
      ]
    })
  });

  assert.equal(response.status, 422);
  const error = (await response.json()) as { readonly error: { readonly code: string; readonly context: readonly string[] } };
  assert.equal(error.error.code, "royalty_split_total_invalid");
  assert.ok(error.error.context.includes("actual=99.999999"));

  const preview = await app.request("/erh/v1/allocations/runs/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:rules-invalid-preview"
    })
  });
  assert.equal(preview.status, 200);
  const allocationPreview = (await preview.json()) as { readonly suspenseCount: number; readonly allocations: readonly { readonly splitPercentage: string }[] };
  assert.equal(allocationPreview.suspenseCount, 0);
  assert.deepEqual(
    allocationPreview.allocations.map((allocation) => allocation.splitPercentage).sort(),
    ["30.000000", "70.000000"]
  );
});

test("contract royalty rules persist only when split equals exactly 100.000000 and feed allocation preview", async () => {
  const app = createWriteEnabledFixtureApiService();
  const body = {
    workspaceId: "workspace_1",
    rules: [
      {
        payeeId: "payee_alma",
        percentage: "60.000000",
        scopeType: null,
        scopeId: null,
        effectiveFrom: "2026-01-01",
        effectiveTo: null
      },
      {
        payeeId: "payee_david",
        percentage: "40.000000",
        scopeType: null,
        scopeId: null,
        effectiveFrom: "2026-01-01",
        effectiveTo: null
      }
    ]
  };

  const response = await app.request("/erh/v1/contracts/contract_1/rules", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-exact-1" },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  const receipt = (await response.json()) as ContractRulesReceipt;
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.contractId, "contract_1");
  assert.equal(receipt.ruleCount, 2);
  assert.equal(receipt.totalPercentage, "100.000000");
  assert.deepEqual(receipt.rules.map((rule) => rule.percentage).sort(), ["40.000000", "60.000000"]);

  const replay = await app.request("/erh/v1/contracts/contract_1/rules", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-exact-1" },
    body: JSON.stringify(body)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as ContractRulesReceipt;
  assert.deepEqual(
    replayReceipt.rules.map((rule) => rule.percentage).sort(),
    ["40.000000", "60.000000"]
  );

  const preview = await app.request("/erh/v1/allocations/runs/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      period: "2026-04",
      lockKey: "distribution:allocation:rules-exact-preview"
    })
  });
  assert.equal(preview.status, 200);
  const allocationPreview = (await preview.json()) as { readonly suspenseCount: number; readonly allocations: readonly { readonly splitPercentage: string }[] };
  assert.equal(allocationPreview.suspenseCount, 0);
  assert.deepEqual(
    allocationPreview.allocations.map((allocation) => allocation.splitPercentage).sort(),
    ["40.000000", "60.000000"]
  );
});

test("contract rules and FX rates are honestly disabled when writes are off", async () => {
  const app = createDisabledFixtureApiService();
  const rules = await app.request("/erh/v1/contracts/contract_1/rules", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      rules: [
        {
          payeeId: "payee_alma",
          percentage: "100.000000",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null
        }
      ]
    })
  });
  assert.equal(rules.status, 501);
  const disabledRules = (await rules.json()) as { readonly error: string; readonly action: string };
  assert.equal(disabledRules.error, "action_not_enabled_yet");
  assert.equal(disabledRules.action, "distribution_contract_rules_update");

  const fxRates = await app.request("/erh/v1/fx-rates", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "fx-rates-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      rates: [
        {
          fromCurrency: "EUR",
          toCurrency: "USD",
          effectiveDate: "2026-04-30",
          rate: "1.1000000000"
        }
      ]
    })
  });
  assert.equal(fxRates.status, 501);
  const disabledFxRates = (await fxRates.json()) as { readonly error: string; readonly action: string };
  assert.equal(disabledFxRates.error, "action_not_enabled_yet");
  assert.equal(disabledFxRates.action, "distribution_fx_rates_save");
});

test("FX rates save upserts exact scale-10 rates and reads after write", async () => {
  const app = createWriteEnabledFixtureApiService();
  const body = {
    workspaceId: "workspace_1",
    rates: [
      {
        fromCurrency: "EUR",
        toCurrency: "USD",
        effectiveDate: "2026-04-30",
        rate: "1.1234567891"
      }
    ]
  };

  const response = await app.request("/erh/v1/fx-rates", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "fx-rates-save-1" },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  const receipt = (await response.json()) as FxRatesReceipt;
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.rateCount, 1);
  assert.equal(receipt.rates[0]?.rate, "1.1234567891");

  const replay = await app.request("/erh/v1/fx-rates", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "fx-rates-save-1" },
    body: JSON.stringify(body)
  });
  assert.equal(replay.status, 200);

  const listed = await app.request("/erh/v1/fx-rates?workspaceId=workspace_1&fromCurrency=EUR&toCurrency=USD&effectiveDate=2026-04-30", {
    headers: authHeaders()
  });
  assert.equal(listed.status, 200);
  const page = (await listed.json()) as { readonly items: readonly { readonly rate: string }[] };
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.rate, "1.1234567891");
});

test("contract rules and FX rates persist idempotently with audit in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteContractRuleTables(pglite);
  await createPgliteFxRateTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const invalid = await app.request("/erh/v1/contracts/contract_1/rules", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-pglite-invalid-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        rules: [
          {
            payeeId: "payee_alma",
            percentage: "99.999999",
            scopeType: null,
            scopeId: null,
            effectiveFrom: "2026-01-01",
            effectiveTo: null
          }
        ]
      })
    });
    assert.equal(invalid.status, 422);
    assert.equal(await pgliteCountWhere(pglite, "royalty_rules", "status = 'active'"), 2);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 0);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 0);

    const exactBody = {
      workspaceId: "workspace_1",
      rules: [
        {
          payeeId: "payee_alma",
          percentage: "50.000000",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null
        },
        {
          payeeId: "payee_david",
          percentage: "50.000000",
          scopeType: null,
          scopeId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null
        }
      ]
    };
    const exact = await app.request("/erh/v1/contracts/contract_1/rules", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-pglite-exact-1" },
      body: JSON.stringify(exactBody)
    });
    assert.equal(exact.status, 200);
    assert.equal(await pgliteCountWhere(pglite, "royalty_rules", "status = 'active'"), 2);
    assert.equal(await pgliteCountWhere(pglite, "royalty_rules", "status = 'archived'"), 2);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);

    const replay = await app.request("/erh/v1/contracts/contract_1/rules", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "contract-rules-pglite-exact-1" },
      body: JSON.stringify(exactBody)
    });
    assert.equal(replay.status, 200);
    assert.equal(await pgliteCountWhere(pglite, "royalty_rules", "status = 'active'"), 2);
    assert.equal(await pgliteCountWhere(pglite, "royalty_rules", "status = 'archived'"), 2);

    const fxRates = await app.request("/erh/v1/fx-rates", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "fx-rates-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        rates: [
          {
            fromCurrency: "EUR",
            toCurrency: "USD",
            effectiveDate: "2026-04-30",
            rate: "1.2000000000"
          }
        ]
      })
    });
    assert.equal(fxRates.status, 200);
    assert.equal(await pgliteCount(pglite, "fx_rates"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 2);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 2);
  } finally {
    await pglite.close();
  }
});

test("identity links are honestly disabled when writes are off", async () => {
  const app = createDisabledFixtureApiService();
  const officeSide = await app.request("/eof/v1/partners/partner_mcb/payee-link", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-office-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      payeeId: "payee_david"
    })
  });
  assert.equal(officeSide.status, 501);
  const officeDisabled = (await officeSide.json()) as { readonly error: string; readonly action: string };
  assert.equal(officeDisabled.error, "action_not_enabled_yet");
  assert.equal(officeDisabled.action, "office_partner_payee_link");

  const distributionSide = await app.request("/erh/v1/payees/payee_david/partner-link", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-distribution-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      officePartnerId: "partner_mcb"
    })
  });
  assert.equal(distributionSide.status, 501);
  const distributionDisabled = (await distributionSide.json()) as { readonly error: string; readonly action: string };
  assert.equal(distributionDisabled.error, "action_not_enabled_yet");
  assert.equal(distributionDisabled.action, "distribution_identity_link");
});

test("office partner payee link is reflected by distribution payee partner GET", async () => {
  const app = createWriteEnabledFixtureApiService();
  const beforeOffice = await app.request("/eof/v1/partners/partner_mcb/payee-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(beforeOffice.status, 200);
  const beforeOfficeLink = (await beforeOffice.json()) as { readonly payeeId: string | null };
  assert.equal(beforeOfficeLink.payeeId, null);

  const beforeDistribution = await app.request("/erh/v1/payees/payee_david/partner-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(beforeDistribution.status, 200);
  const beforeDistributionLink = (await beforeDistribution.json()) as { readonly officePartnerId: string | null; readonly linked: boolean };
  assert.equal(beforeDistributionLink.officePartnerId, null);
  assert.equal(beforeDistributionLink.linked, false);

  const response = await app.request("/eof/v1/partners/partner_mcb/payee-link", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-office-link-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      payeeId: "payee_david"
    })
  });
  assert.equal(response.status, 200);
  const receipt = (await response.json()) as IdentityLinkReceipt;
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.officePartnerId, "partner_mcb");
  assert.equal(receipt.payeeId, "payee_david");
  assert.equal(receipt.officeLink.resolution, "stored_link");
  assert.equal(receipt.officeLink.source, "identity_link");
  assert.equal(receipt.distributionLink.linked, true);

  const replay = await app.request("/eof/v1/partners/partner_mcb/payee-link", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-office-link-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      payeeId: "payee_david"
    })
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as IdentityLinkReceipt;
  assert.equal(replayReceipt.officePartnerId, receipt.officePartnerId);
  assert.equal(replayReceipt.payeeId, receipt.payeeId);

  const afterOffice = await app.request("/eof/v1/partners/partner_mcb/payee-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(afterOffice.status, 200);
  const afterOfficeLink = (await afterOffice.json()) as { readonly payeeId: string | null; readonly resolution: string; readonly source: string };
  assert.equal(afterOfficeLink.payeeId, "payee_david");
  assert.equal(afterOfficeLink.resolution, "stored_link");
  assert.equal(afterOfficeLink.source, "identity_link");

  const afterDistribution = await app.request("/erh/v1/payees/payee_david/partner-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(afterDistribution.status, 200);
  const afterDistributionLink = (await afterDistribution.json()) as { readonly officePartnerId: string | null; readonly linked: boolean; readonly confidence: string | null };
  assert.equal(afterDistributionLink.officePartnerId, "partner_mcb");
  assert.equal(afterDistributionLink.linked, true);
  assert.equal(afterDistributionLink.confidence, "100.000000");
});

test("distribution payee partner link is reflected by office partner payee GET", async () => {
  const app = createWriteEnabledFixtureApiService();
  const response = await app.request("/erh/v1/payees/payee_david/partner-link", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-distribution-link-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      officePartnerId: "partner_mcb"
    })
  });
  assert.equal(response.status, 200);
  const receipt = (await response.json()) as IdentityLinkReceipt;
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.officePartnerId, "partner_mcb");
  assert.equal(receipt.payeeId, "payee_david");
  assert.equal(receipt.officeLink.payeeId, "payee_david");
  assert.equal(receipt.distributionLink.officePartnerId, "partner_mcb");

  const officeGet = await app.request("/eof/v1/partners/partner_mcb/payee-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(officeGet.status, 200);
  const officeLink = (await officeGet.json()) as { readonly payeeId: string | null; readonly confidence: string | null };
  assert.equal(officeLink.payeeId, "payee_david");
  assert.equal(officeLink.confidence, "100.000000");

  const distributionGet = await app.request("/erh/v1/payees/payee_david/partner-link?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(distributionGet.status, 200);
  const distributionLink = (await distributionGet.json()) as { readonly officePartnerId: string | null; readonly linked: boolean };
  assert.equal(distributionLink.officePartnerId, "partner_mcb");
  assert.equal(distributionLink.linked, true);
});

test("identity links upsert one active pair with idempotency and audit in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  await createPgliteIdentityLinkTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const officeSide = await app.request("/eof/v1/partners/partner_mcb/payee-link", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-pglite-office-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        payeeId: "payee_david"
      })
    });
    assert.equal(officeSide.status, 200);
    assert.equal(await pgliteCount(pglite, "identity_link"), 1);
    assert.equal(await pgliteCountWhere(pglite, "identity_link", "status = 'linked'"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);

    const replay = await app.request("/eof/v1/partners/partner_mcb/payee-link", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-pglite-office-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        payeeId: "payee_david"
      })
    });
    assert.equal(replay.status, 200);
    assert.equal(await pgliteCount(pglite, "identity_link"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);

    const distributionSide = await app.request("/erh/v1/payees/payee_david/partner-link", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "identity-pglite-distribution-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        officePartnerId: "partner_bedouin"
      })
    });
    assert.equal(distributionSide.status, 200);
    assert.equal(await pgliteCount(pglite, "identity_link"), 2);
    assert.equal(await pgliteCountWhere(pglite, "identity_link", "status = 'linked'"), 1);
    assert.equal(await pgliteCountWhere(pglite, "identity_link", "status = 'archived'"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 2);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 2);
  } finally {
    await pglite.close();
  }
});

test("import previews are permission-checked but not gated by WRITES_ENABLED", async () => {
  const app = createDisabledFixtureApiService();

  const viewerPreview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-viewer-token"), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank.csv",
      checksum: "checksum-bank-preview-viewer",
      rows: [{ date: "2026-02-20", description: "Viewer row", amount: "1.00", currency: "MUR", accountId: "bank_mur" }]
    })
  });
  assert.equal(viewerPreview.status, 403);

  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank.csv",
      checksum: "checksum-bank-preview-admin",
      rows: [{ date: "2026-02-20", description: "Admin row", amount: "1.00", currency: "MUR", accountId: "bank_mur" }]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string; readonly acceptedRowCount: number };
  assert.equal(previewJson.acceptedRowCount, 1);

  const confirmDisabled = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-disabled-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      previewId: previewJson.previewId,
      acceptedRowIds: ["row_1"],
      rejectedRowIds: []
    })
  });
  assert.equal(confirmDisabled.status, 501);
  const disabled = (await confirmDisabled.json()) as { readonly error: string; readonly action: string };
  assert.equal(disabled.error, "action_not_enabled_yet");
  assert.equal(disabled.action, "office_bank_import_confirm");
});

test("office bank import confirm persists lines once and replays idempotent responses", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank.csv",
      checksum: "checksum-bank-confirm-real",
      rows: [{ date: "2026-02-20", description: "Imported bank line", amount: "12.34", currency: "MUR", accountId: "bank_mur", reference: "IMP-1" }]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string };
  const confirmBody = {
    workspaceId: "workspace_1",
    previewId: previewJson.previewId,
    acceptedRowIds: ["row_1"],
    rejectedRowIds: []
  };

  const confirm = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-real-1" },
    body: JSON.stringify(confirmBody)
  });
  assert.equal(confirm.status, 200);
  const receipt = (await confirm.json()) as { readonly id: string; readonly auditEventId: string | null; readonly importedTransactionCount: number };
  assert.equal(receipt.importedTransactionCount, 1);
  assert.ok(receipt.auditEventId !== null);

  const replay = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-real-1" },
    body: JSON.stringify(confirmBody)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as { readonly id: string };
  assert.equal(replayReceipt.id, receipt.id);

  const conflict = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-real-1" },
    body: JSON.stringify({ ...confirmBody, rejectedRowIds: ["row_2"] })
  });
  assert.equal(conflict.status, 409);

  const raw = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1&period=2026-02&limit=100", {
    headers: authHeaders()
  });
  assert.equal(raw.status, 200);
  const rawPage = (await raw.json()) as { readonly items: readonly { readonly reference: string }[] };
  assert.equal(rawPage.items.filter((item) => item.reference === "IMP-1").length, 1);
});

test("distribution import confirm persists raw rows and does not fabricate normalized earnings", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/erh/v1/imports/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "routenote",
      fileName: "routenote.csv",
      checksum: "checksum-distribution-confirm-real",
      rows: [{ title: "Raw song", artist: "Raw artist", currency: "USD", amount: "9.99" }]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string; readonly unmappedRowCount: number };
  assert.equal(previewJson.unmappedRowCount, 1);

  const confirm = await app.request("/erh/v1/imports/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-confirm-real-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      previewId: previewJson.previewId,
      acceptedRowIds: ["row_1"],
      rejectedRowIds: []
    })
  });
  assert.equal(confirm.status, 200);
  const receipt = (await confirm.json()) as { readonly id: string; readonly importedRoyaltyEventCount: number; readonly normalizedRowCount: number };
  assert.equal(receipt.importedRoyaltyEventCount, 0);
  assert.equal(receipt.normalizedRowCount, 0);

  const batches = await app.request("/erh/v1/imports/batches?workspaceId=workspace_1&status=failed&limit=100", {
    headers: authHeaders()
  });
  assert.equal(batches.status, 200);
  const batchPage = (await batches.json()) as { readonly items: readonly { readonly id: string; readonly status: string }[] };
  assert.ok(batchPage.items.some((item) => item.id === receipt.id && item.status === "failed"));
});

test("office bank import confirm writes idempotency, audit, batch, and lines in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  try {
    const preview = await app.request("/eof/v1/bank-import/preview", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        source: "csv",
        fileName: "pglite-bank.csv",
        checksum: "checksum-bank-pglite",
        rows: [{ date: "2026-02-21", description: "PGlite line", amount: "23.45", currency: "MUR", accountId: "bank_mur", reference: "PGL-1" }]
      })
    });
    assert.equal(preview.status, 200);
    const previewJson = (await preview.json()) as { readonly previewId: string };

    const confirm = await app.request("/eof/v1/bank-import/confirm", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-pglite-1" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        previewId: previewJson.previewId,
        acceptedRowIds: ["row_1"],
        rejectedRowIds: []
      })
    });
    assert.equal(confirm.status, 200);

    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "office_bank_import_batches"), 1);
    assert.equal(await pgliteCount(pglite, "office_bank_statement_lines"), 1);
  } finally {
    await pglite.close();
  }
});

function authHeaders(): Readonly<Record<string, string>> {
  return authHeadersForToken("fixture-valid-token");
}

async function jsonWrite(
  app: ReturnType<typeof createApiService>,
  path: string,
  method: "POST" | "PATCH",
  idempotencyKey: string,
  body: Readonly<Record<string, unknown>>
): Promise<{ readonly id?: string; readonly runId?: string; readonly auditEventId: string | null }> {
  const response = await app.request(path, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  return (await response.json()) as { readonly id?: string; readonly runId?: string; readonly auditEventId: string | null };
}

function assertReceipt(receipt: { readonly id?: string; readonly runId?: string; readonly auditEventId: string | null }): void {
  assert.ok((receipt.id ?? receipt.runId ?? "").length > 0);
  assert.ok(receipt.auditEventId !== null);
}

function authHeadersForToken(token: string): Readonly<Record<string, string>> {
  return {
    Authorization: `Bearer ${token}`
  };
}

function createWriteEnabledFixtureApiService(): ReturnType<typeof createApiService> {
  return createApiService({
    fixtures: createFixtureStore(),
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });
}

function createWriteEnabledFixtureApiServiceWithOverrides(
  overrides: Partial<ReturnType<typeof createFixtureStore>>
): ReturnType<typeof createApiService> {
  return createApiService({
    fixtures: {
      ...createFixtureStore(),
      ...overrides
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });
}

function createDisabledFixtureApiService(): ReturnType<typeof createApiService> {
  return createApiService({
    fixtures: createFixtureStore(),
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });
}

function createTestAuthVerifier(): SupabaseJwtVerifier {
  return {
    verify: async (token: string): Promise<AuthenticatedApiUser> => {
      if (token === "fixture-viewer-token") {
        return {
          userId: "user_viewer",
          email: "viewer@eeee.mu",
          role: "viewer",
          workspaceId: null
        };
      }

      if (token === "fixture-bot-office-token") {
        return {
          userId: "bot_sophie",
          email: "sophie@eeee.mu",
          role: "bot_office",
          workspaceId: "eeee-mu"
        };
      }

      if (token === "fixture-bot-distribution-token") {
        return {
          userId: "bot_theo",
          email: "theo@eeee.mu",
          role: "bot_distribution",
          workspaceId: "eeee-mu"
        };
      }

      if (token !== "fixture-valid-token") {
        throw new Error(`Unexpected fixture auth token: ${token}`);
      }

      return {
        userId: "user_fixture",
        email: "fixture@eeee.mu",
        role: "administrator",
        workspaceId: "eeee-mu"
      };
    }
  };
}

async function createPgliteWriteTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table api_idempotency_keys (
      key text primary key,
      route text not null,
      request_hash text not null,
      response_json jsonb,
      created_at timestamp with time zone default now() not null
    );

    create table api_import_previews (
      preview_id text primary key,
      workspace_id text not null,
      kind varchar(64) not null,
      payload_json jsonb not null,
      created_at timestamp with time zone default now() not null,
      expires_at timestamp with time zone
    );

    create table audit_logs (
      id uuid primary key,
      legacy_id integer,
      entity_type varchar(160) not null,
      entity_id text not null,
      action varchar(160) not null,
      actor_user_id text,
      before jsonb not null default '{}'::jsonb,
      after jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamp with time zone default now() not null
    );

    create table office_bank_import_batches (
      id uuid primary key,
      workspace_id text not null,
      source text not null,
      file_name text not null,
      checksum text not null,
      account_id text,
      period_start date,
      period_end date,
      opening_balance_minor bigint,
      closing_balance_minor bigint,
      currency char(3),
      accepted_row_count integer not null default 0,
      rejected_row_count integer not null default 0,
      duplicate_row_count integer not null default 0,
      idempotency_fingerprint text not null,
      status text not null default 'previewed',
      imported_at timestamp with time zone,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null
    );

    create table office_bank_statement_lines (
      id uuid primary key,
      import_batch_id uuid not null,
      account_id text not null,
      occurred_on date not null,
      value_on date,
      description text not null,
      reference text,
      direction text not null,
      amount_minor bigint not null,
      balance_minor bigint,
      currency char(3) not null,
      amount_mur_minor bigint not null,
      balance_mur_minor bigint,
      is_duplicate_candidate boolean not null default false,
      reconciliation_status text not null default 'unmatched',
      matched_transaction_id text,
      raw_data jsonb not null default '{}'::jsonb,
      created_at timestamp with time zone default now() not null
    );
  `);
}

async function createPgliteAllocationTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table calculation_runs (
      id text primary key,
      batch_id text,
      status text not null default 'pending',
      reconciliation_json jsonb not null default '{}'::jsonb,
      started_at timestamp with time zone,
      finished_at timestamp with time zone,
      created_at timestamp with time zone default now() not null
    );

    create table earning_allocations (
      id text primary key,
      earning_id text not null,
      calculation_run_id text not null,
      payee_id text not null,
      contract_id text,
      track_id text,
      gross_amount numeric(28, 10) not null,
      original_gross_amount numeric(28, 10) not null,
      fx_rate numeric(24, 10),
      gross_share numeric(28, 10) not null,
      recoupment_applied numeric(28, 10) not null,
      net_payable numeric(28, 10) not null,
      split_percentage numeric(12, 6) not null,
      currency char(3) not null,
      original_currency char(3) not null,
      status text not null default 'preview',
      created_at timestamp with time zone default now() not null
    );

    create table contract_cost_terms (
      id text primary key,
      status text not null,
      updated_at timestamp with time zone default now() not null
    );

    insert into contract_cost_terms (id, status)
    values ('cost_advance', 'open');

    create table expense_applications (
      id text primary key,
      cost_term_id text not null,
      payee_id text not null,
      statement_id text,
      calculation_run_id text,
      amount_applied numeric(28, 10) not null,
      currency char(3) not null,
      created_at timestamp with time zone default now() not null
    );

    create table suspense_items (
      id text primary key,
      earning_id text,
      amount numeric(28, 10) not null,
      currency char(3) not null,
      reason_code text not null,
      resolved boolean not null default false,
      resolved_at timestamp with time zone,
      created_at timestamp with time zone default now() not null
    );
  `);
}

async function createPgliteStatementTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table statements (
      id text primary key,
      payee_id text not null,
      calculation_run_id text,
      period_start date not null,
      period_end date not null,
      currency char(3) not null,
      gross_total numeric(28, 10) not null,
      recoupment_total numeric(28, 10) not null,
      net_payable numeric(28, 10) not null,
      amount_due numeric(28, 10) not null,
      version integer not null default 1,
      status text not null default 'draft',
      locked_at timestamp with time zone,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      unique (payee_id, period_start, period_end, currency, version)
    );

    create table statement_lines (
      id text primary key,
      statement_id text not null,
      earning_allocation_id text,
      track_id text,
      gross_share numeric(28, 10) not null,
      recoupment_applied numeric(28, 10) not null,
      net_payable numeric(28, 10) not null,
      quantity numeric(24, 6) not null,
      currency char(3) not null,
      created_at timestamp with time zone default now() not null
    );

    create table payee_balances (
      id text primary key,
      payee_id text not null,
      statement_id text,
      currency char(3) not null,
      opening_balance numeric(28, 10) not null,
      period_net numeric(28, 10) not null,
      closing_balance numeric(28, 10) not null,
      movement_type text not null,
      created_at timestamp with time zone default now() not null
    );
  `);
}

async function createPglitePaymentTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table payments (
      id text primary key,
      payee_id text not null,
      amount numeric(28, 10) not null,
      currency char(3) not null,
      exchange_rate numeric(24, 10),
      status text not null default 'recorded',
      paid_at timestamp with time zone,
      reference text,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null
    );

    create table statement_payment_links (
      id text primary key,
      statement_id text not null,
      payment_id text not null,
      amount_applied numeric(28, 10) not null,
      created_at timestamp with time zone default now() not null,
      unique (statement_id, payment_id)
    );
  `);
}

async function createPgliteContractRuleTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table royalty_rules (
      id text primary key,
      contract_id text not null,
      payee_id text not null,
      percentage numeric(12, 6) not null,
      scope_type text,
      scope_id text,
      priority integer not null default 0,
      effective_from date,
      effective_to date,
      recoupable boolean not null default true,
      status text not null default 'draft',
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null
    );

    insert into royalty_rules (id, contract_id, payee_id, percentage, priority, effective_from, status)
    values
      ('rule_alma', 'contract_1', 'payee_alma', '70.000000', 2, '2026-01-01', 'active'),
      ('rule_david', 'contract_1', 'payee_david', '30.000000', 1, '2026-01-01', 'active');
  `);
}

async function createPgliteFxRateTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table fx_rates (
      id text primary key,
      from_currency char(3) not null,
      to_currency char(3) not null,
      rate numeric(24, 10) not null,
      effective_date date not null,
      created_at timestamp with time zone default now() not null,
      unique (from_currency, to_currency, effective_date)
    );
  `);
}

async function createPgliteIdentityLinkTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table identity_link (
      id text primary key,
      payee_id text not null,
      office_partner_id text not null,
      confidence numeric(12, 6) not null,
      status text not null default 'pending',
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      unique (payee_id, office_partner_id)
    );
  `);
}

async function pgliteCount(pglite: PGlite, tableName: string): Promise<number> {
  const result = await pglite.query(`select count(*)::int as count from ${tableName}`);
  const row = result.rows[0] as Readonly<Record<string, unknown>> | undefined;
  assert.ok(row !== undefined);
  return Number(row.count);
}

async function pgliteCountWhere(pglite: PGlite, tableName: string, whereClause: string): Promise<number> {
  const result = await pglite.query(`select count(*)::int as count from ${tableName} where ${whereClause}`);
  const row = result.rows[0] as Readonly<Record<string, unknown>> | undefined;
  assert.ok(row !== undefined);
  return Number(row.count);
}

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}
