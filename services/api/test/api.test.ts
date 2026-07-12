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
  readonly paymentStatus: "recorded" | "edited" | "reconciled" | "voided";
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
  assert.notEqual(dashboard.previous, null);
  assert.equal(dashboard.previous.dateFrom, "2026-01-01");
  assert.equal(dashboard.previous.dateTo, "2026-01-31");

  const yearScopedResponse = await app.request(
    "/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02&dateFrom=2026-01-01&dateTo=2026-12-31",
    { headers: authHeaders() }
  );
  assert.equal(yearScopedResponse.status, 200);
  const yearScoped = await yearScopedResponse.json();
  assert.equal(yearScoped.previous.dateFrom, "2025-01-01");
  assert.equal(yearScoped.previous.dateTo, "2025-12-31");

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

test("Office global P&L is scoped to requested workspace", async () => {
  const fixtures = createFixtureStore();
  fixtures.office.transactions = [
    ...fixtures.office.transactions,
    {
      ...fixtures.office.transactions[0],
      id: "tx_scope_canonical_income",
      workspaceId: "eeee-mu",
      transactionDate: "2026-02-20T10:00:00.000Z",
      type: "income",
      status: "validated",
      isActive: true,
      amountMinor: 70_000n
    }
  ];
  fixtures.office.financialAllocations = [
    ...fixtures.office.financialAllocations,
    {
      id: "alloc_scope_canonical_income",
      transactionId: "tx_scope_canonical_income",
      departmentId: "dept_ops",
      amountMinor: 70_000n
    }
  ];

  const app = createApiService({
    fixtures,
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const canonicalResponse = await app.request("/eof/v1/pl/global?workspaceId=eeee-mu&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(canonicalResponse.status, 200);
  const canonical = (await canonicalResponse.json()) as {
    readonly incomeMicro: string;
    readonly expenseMicro: string;
    readonly netMicro: string;
  };
  assert.equal(canonical.incomeMicro, "700.00");
  assert.equal(canonical.expenseMicro, "0.00");
  assert.equal(canonical.netMicro, "700.00");

  const aliasResponse = await app.request("/eof/v1/pl/global?workspaceId=office&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(aliasResponse.status, 200);
  const alias = (await aliasResponse.json()) as {
    readonly incomeMicro: string;
    readonly expenseMicro: string;
    readonly netMicro: string;
  };
  assert.equal(alias.incomeMicro, canonical.incomeMicro);
  assert.equal(alias.expenseMicro, canonical.expenseMicro);
  assert.equal(alias.netMicro, canonical.netMicro);

  const legacyResponse = await app.request("/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(legacyResponse.status, 200);
  const legacy = (await legacyResponse.json()) as {
    readonly incomeMicro: string;
    readonly expenseMicro: string;
    readonly netMicro: string;
  };
  assert.equal(legacy.incomeMicro, "5000.00");
  assert.equal(legacy.expenseMicro, "1250.00");
  assert.equal(legacy.netMicro, "3750.00");
});

test("Office scoped reads keep reference projects and partner detail available", async () => {
  const app = createFixtureApiService();

  const projectsResponse = await app.request("/eof/v1/projects?workspaceId=eeee-mu&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(projectsResponse.status, 200);
  const projects = (await projectsResponse.json()) as {
    readonly items: readonly { readonly id: string; readonly periodIncomeMicro: string; readonly periodExpenseMicro: string }[];
  };
  const projectIds = new Set(projects.items.map((project) => project.id));
  assert.ok(projectIds.has("project_kaya"));
  assert.ok(projectIds.has("project_null_reference"));
  const kaya = projects.items.find((project) => project.id === "project_kaya");
  assert.notEqual(kaya, undefined);
  assert.equal(kaya.periodIncomeMicro, "0.00");
  assert.equal(kaya.periodExpenseMicro, "0.00");

  const partnerResponse = await app.request("/eof/v1/partners/partner_mcb?workspaceId=eeee-mu", {
    headers: authHeaders()
  });
  assert.equal(partnerResponse.status, 200);
  const partner = (await partnerResponse.json()) as { readonly id: string; readonly name: string };
  assert.equal(partner.id, "partner_mcb");
  assert.equal(partner.name, "MCB");
});

test("Projects list totals follow period and explicit date range filters", async () => {
  const app = createFixtureApiService();

  const februaryResponse = await app.request("/eof/v1/projects?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(februaryResponse.status, 200);
  const februaryProjects = await februaryResponse.json() as { readonly items: readonly { readonly id: string; readonly periodIncomeMicro: string; readonly periodExpenseMicro: string; readonly netMicro: string }[] };
  const februaryKaya = februaryProjects.items.find((project) => project.id === "project_kaya");
  assert.notEqual(februaryKaya, undefined);
  assert.equal(februaryKaya.periodIncomeMicro, "5000.00");
  assert.equal(februaryKaya.periodExpenseMicro, "1200.00");
  assert.equal(februaryKaya.netMicro, "3800.00");

  const januaryResponse = await app.request("/eof/v1/projects?workspaceId=workspace_1&period=2026-01", {
    headers: authHeaders()
  });
  assert.equal(januaryResponse.status, 200);
  const januaryProjects = await januaryResponse.json() as { readonly items: readonly { readonly id: string; readonly periodIncomeMicro: string; readonly periodExpenseMicro: string; readonly netMicro: string }[] };
  const januaryKaya = januaryProjects.items.find((project) => project.id === "project_kaya");
  assert.notEqual(januaryKaya, undefined);
  assert.equal(januaryKaya.periodIncomeMicro, "0.00");
  assert.equal(januaryKaya.periodExpenseMicro, "0.00");
  assert.equal(januaryKaya.netMicro, "0.00");

  const narrowRangeResponse = await app.request(
    "/eof/v1/projects?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-05",
    { headers: authHeaders() }
  );
  assert.equal(narrowRangeResponse.status, 200);
  const narrowRangeProjects = await narrowRangeResponse.json() as { readonly items: readonly { readonly id: string; readonly periodIncomeMicro: string; readonly periodExpenseMicro: string; readonly netMicro: string }[] };
  const narrowRangeKaya = narrowRangeProjects.items.find((project) => project.id === "project_kaya");
  assert.notEqual(narrowRangeKaya, undefined);
  assert.equal(narrowRangeKaya.periodIncomeMicro, "5000.00");
  assert.equal(narrowRangeKaya.periodExpenseMicro, "0.00");
  assert.equal(narrowRangeKaya.netMicro, "5000.00");
});

test("Bank quality analytics follow explicit date range filters", async () => {
  const app = createFixtureApiService();

  const fullMonthResponse = await app.request("/eof/v1/analytics/bank-quality?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });
  assert.equal(fullMonthResponse.status, 200);
  const fullMonth = await fullMonthResponse.json() as {
    readonly matchedRateBp: number;
    readonly unmatchedLineCount: number;
    readonly duplicateCandidateCount: number;
    readonly missingReferenceCount: number;
  };
  assert.equal(fullMonth.matchedRateBp, 6667);
  assert.equal(fullMonth.unmatchedLineCount, 1);
  assert.equal(fullMonth.duplicateCandidateCount, 1);
  assert.equal(fullMonth.missingReferenceCount, 1);

  const narrowRangeResponse = await app.request(
    "/eof/v1/analytics/bank-quality?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-05",
    { headers: authHeaders() }
  );
  assert.equal(narrowRangeResponse.status, 200);
  const narrowRange = await narrowRangeResponse.json() as {
    readonly matchedRateBp: number;
    readonly unmatchedLineCount: number;
    readonly duplicateCandidateCount: number;
    readonly missingReferenceCount: number;
  };
  assert.equal(narrowRange.matchedRateBp, 10000);
  assert.equal(narrowRange.unmatchedLineCount, 0);
  assert.equal(narrowRange.duplicateCandidateCount, 0);
  assert.equal(narrowRange.missingReferenceCount, 0);
});

test("P&L category lines support cursor pagination with a common token", async () => {
  const app = createFixtureApiService();

  const firstResponse = await app.request(
    "/eof/v1/pl/category?workspaceId=workspace_1&period=2026-02&limit=1",
    { headers: authHeaders() }
  );
  assert.equal(firstResponse.status, 200);
  const firstPage = await firstResponse.json() as {
    readonly items: readonly { readonly id: string; readonly label: string }[];
    readonly nextCursor: string | null;
  };
  assert.equal(firstPage.items.length, 1);
  assert.equal(firstPage.nextCursor, "1");

  const secondResponse = await app.request(
    "/eof/v1/pl/category?workspaceId=workspace_1&period=2026-02&limit=1&cursor=1",
    { headers: authHeaders() }
  );
  assert.equal(secondResponse.status, 200);
  const secondPage = await secondResponse.json() as {
    readonly items: readonly { readonly id: string; readonly label: string }[];
    readonly nextCursor: string | null;
  };
  assert.equal(secondPage.items.length, 1);
  assert.notEqual(secondPage.items[0]?.id, firstPage.items[0]?.id);
});

test("Dashboard analytics returns the 5 KPI datasets for Office dashboard", async () => {
  const app = createFixtureApiService();

  const response = await app.request(
    "/eof/v1/analytics/dashboard?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-28",
    { headers: authHeaders() }
  );
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly runway: {
      readonly period: string;
      readonly cashBalanceMicro: string;
      readonly runwayMonths: string | null;
      readonly monthsUsed: readonly string[];
      readonly excludedForeignAccounts: readonly {
        readonly accountId: string;
        readonly currency: string;
        readonly accountLabel: string;
        readonly balanceMicro: string;
      }[];
    };
    readonly topExpenseCategories: readonly { readonly categoryId: string; readonly expenseMicro: string }[];
    readonly projectProfitability: readonly { readonly projectId: string; readonly netMicro: string }[];
    readonly reconciliationByAccount: readonly { readonly accountId: string; readonly unmatchedLineCount: number }[];
    readonly expenseTrendMonths: readonly string[];
    readonly expenseTrendByDepartment: readonly { readonly departmentId: string; readonly latestMonthExpenseMicro: string }[];
  };

  assert.equal(payload.period, "2026-02");
  assert.equal(payload.dateFrom, "2026-02-01");
  assert.equal(payload.dateTo, "2026-02-28");
  assert.equal(payload.runway.period, "2026-02");
  assert.equal(payload.runway.cashBalanceMicro, "2500.00");
  assert.ok(Array.isArray(payload.runway.monthsUsed));
  assert.equal(payload.runway.excludedForeignAccounts.length, 1);
  assert.equal(payload.runway.excludedForeignAccounts[0]?.accountId, "bank_eur");
  assert.equal(payload.runway.excludedForeignAccounts[0]?.currency, "EUR");
  assert.equal(payload.runway.excludedForeignAccounts[0]?.accountLabel, "MCB EUR");
  assert.equal(payload.runway.excludedForeignAccounts[0]?.balanceMicro, "10.00");
  assert.ok(payload.topExpenseCategories.length > 0);
  assert.ok(payload.projectProfitability.length > 0);
  assert.ok(payload.reconciliationByAccount.length > 0);
  assert.equal(payload.expenseTrendMonths.length, 6);
  assert.ok(payload.expenseTrendByDepartment.length > 0);
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

test("Command Center notifications expose guarded live readiness items", async () => {
  const app = createDisabledFixtureApiService();

  const response = await app.request("/cc/v1/notifications?workspaceId=eeee-mu", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const notifications = (await response.json()) as {
    readonly workspaceId: string;
    readonly unreadCount: number;
    readonly items: readonly {
      readonly id: string;
      readonly title: string;
      readonly actionHref: string | null;
    }[];
  };
  assert.equal(notifications.workspaceId, "eeee-mu");
  assert.ok(notifications.unreadCount > 0);
  assert.ok(notifications.items.some((item) => item.id === "write-gate" && item.actionHref === "/console/command-center/integrations"));

  const botDenied = await app.request("/cc/v1/notifications?workspaceId=eeee-mu", {
    headers: authHeadersForToken("fixture-bot-distribution-token")
  });
  assert.equal(botDenied.status, 403);
  assert.equal((await botDenied.json()).error.code, "bot_route_denied");
});

test("Command Center overview merges persisted integration and setting overrides", async () => {
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
    await pglite.exec(`
      insert into command_center_integration_states (workspace_id, integration_id, enabled, status, updated_by_user_id)
      values
        ('eeee-mu', 'mcp', false, 'disabled', 'user_fixture'),
        ('eeee-mu', 'mcb', true, 'attention', 'user_fixture');

      insert into command_center_settings (workspace_id, key, value_json, status, updated_by_user_id)
      values
        ('eeee-mu', 'theme', '{"name":"Light command room"}'::jsonb, 'review', 'user_fixture'),
        ('eeee-mu', 'ops-window', '{"value":"02:00 UTC"}'::jsonb, 'required', 'user_fixture');
    `);

    const response = await app.request("/cc/v1/overview?workspaceId=eeee-mu", {
      headers: authHeaders()
    });
    assert.equal(response.status, 200);
    const overview = (await response.json()) as {
      readonly workspaceId: string;
      readonly generatedAt: string;
      readonly readiness: readonly { readonly id: string; readonly tone: string }[];
      readonly integrations: readonly { readonly id: string; readonly status: string; readonly action: string }[];
      readonly settings: readonly { readonly id: string; readonly value: string; readonly status: string; readonly tone: string }[];
    };

    assert.equal(overview.workspaceId, "eeee-mu");
    assert.equal(overview.generatedAt, "2026-06-21T00:00:00.000Z");
    assert.ok(overview.readiness.some((item) => item.id === "write-gate" && item.tone === "success"));

    const mcp = overview.integrations.find((integration) => integration.id === "mcp");
    assert.notEqual(mcp, undefined);
    assert.equal(mcp.status, "idle");
    assert.equal(mcp.action, "Enable");

    const mcb = overview.integrations.find((integration) => integration.id === "mcb");
    assert.notEqual(mcb, undefined);
    assert.equal(mcb.status, "attention");
    assert.equal(mcb.action, "Manage");

    const theme = overview.settings.find((setting) => setting.id === "theme");
    assert.notEqual(theme, undefined);
    assert.equal(theme.value, "Light command room");
    assert.equal(theme.status, "review");
    assert.equal(theme.tone, "warning");

    const opsWindow = overview.settings.find((setting) => setting.id === "ops-window");
    assert.notEqual(opsWindow, undefined);
    assert.equal(opsWindow.value, "02:00 UTC");
    assert.equal(opsWindow.status, "required");
    assert.equal(opsWindow.tone, "warning");
  } finally {
    await pglite.close();
  }
});

test("Command Center integration toggle persists state and replays idempotently", async () => {
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
    const payload = {
      workspaceId: "eeee-mu",
      integrationId: "mcb",
      enabled: false,
      status: "disabled"
    };

    const first = await app.request("/cc/v1/integrations/mcb/toggle", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "cc-toggle-pglite-1" },
      body: JSON.stringify(payload)
    });
    assert.equal(first.status, 200);
    const firstReceipt = (await first.json()) as { readonly id: string; readonly auditEventId: string | null };
    assert.equal(firstReceipt.id, "eeee-mu:integration:mcb");
    assert.ok(firstReceipt.auditEventId !== null);
    assert.equal(await pgliteCount(pglite, "command_center_integration_states"), 1);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCountWhere(pglite, "audit_logs", "action = 'command_center_integration_toggle'"), 1);

    const persistedStateResult = await pglite.query(
      "select enabled, status, updated_by_user_id from command_center_integration_states where workspace_id = $1 and integration_id = $2",
      ["eeee-mu", "mcb"]
    );
    const persistedState = persistedStateResult.rows[0] as
      | { readonly enabled: boolean; readonly status: string; readonly updated_by_user_id: string }
      | undefined;
    assert.notEqual(persistedState, undefined);
    assert.equal(persistedState.enabled, false);
    assert.equal(persistedState.status, "disabled");
    assert.equal(persistedState.updated_by_user_id, "user_fixture");

    const replay = await app.request("/cc/v1/integrations/mcb/toggle", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "cc-toggle-pglite-1" },
      body: JSON.stringify(payload)
    });
    assert.equal(replay.status, 200);
    const replayReceipt = (await replay.json()) as { readonly id: string; readonly auditEventId: string | null };
    assert.equal(replayReceipt.id, firstReceipt.id);
    assert.equal(replayReceipt.auditEventId, firstReceipt.auditEventId);
    assert.equal(await pgliteCount(pglite, "command_center_integration_states"), 1);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCountWhere(pglite, "audit_logs", "action = 'command_center_integration_toggle'"), 1);

    const conflict = await app.request("/cc/v1/integrations/mcb/toggle", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "cc-toggle-pglite-1" },
      body: JSON.stringify({ ...payload, enabled: true, status: "connected" })
    });
    assert.equal(conflict.status, 409);

    const overview = await app.request("/cc/v1/overview?workspaceId=eeee-mu", {
      headers: authHeaders()
    });
    assert.equal(overview.status, 200);
    const overviewJson = (await overview.json()) as {
      readonly integrations: readonly { readonly id: string; readonly status: string; readonly action: string }[];
    };
    const mcb = overviewJson.integrations.find((integration) => integration.id === "mcb");
    assert.notEqual(mcb, undefined);
    assert.equal(mcb.status, "idle");
    assert.equal(mcb.action, "Enable");
  } finally {
    await pglite.close();
  }
});

test("read routes enforce server-side workspace authorization, not just the UI", async () => {
  const app = createDisabledFixtureApiService();
  const officeRead = "/eof/v1/dashboard?workspaceId=eeee-mu&period=2026-02";
  const distributionRead = "/erh/v1/dashboard?workspaceId=eeee-mu&period=2026-06";
  const commandCenterRead = "/cc/v1/status";

  // A viewer (what office@eeee.mu resolves to when the JWT carries no role claim) must be
  // denied on every domain's READ routes — the reported hole was that these returned 200.
  for (const path of [officeRead, distributionRead, commandCenterRead]) {
    const denied = await app.request(path, { headers: authHeadersForToken("fixture-viewer-token") });
    assert.equal(denied.status, 403, `viewer must be denied on ${path}`);
    assert.equal((await denied.json()).error.code, "workspace_access_denied");
  }

  // The office role reaches Office only — denied on Distribution and Command Center.
  const officeOnOffice = await app.request(officeRead, { headers: authHeadersForToken("fixture-office-token") });
  assert.equal(officeOnOffice.status, 200);
  const officeOnDistribution = await app.request(distributionRead, { headers: authHeadersForToken("fixture-office-token") });
  assert.equal(officeOnDistribution.status, 403);
  const officeOnCommandCenter = await app.request(commandCenterRead, { headers: authHeadersForToken("fixture-office-token") });
  assert.equal(officeOnCommandCenter.status, 403);

  // An administrator still reaches every domain.
  const adminOnDistribution = await app.request(distributionRead, { headers: authHeaders() });
  assert.equal(adminOnDistribution.status, 200);
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

  assert.equal(fee.accountId, "bank_mur");
  assert.equal(pending.accountId, null);

  const filteredResponse = await app.request("/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&accountId=bank_mur&limit=10", {
    headers: authHeaders()
  });
  const filteredPage = await filteredResponse.json();
  assert.ok(filteredPage.items.some((item: { readonly id: string }) => item.id === "tx_mcb_fee"));
  assert.ok(!filteredPage.items.some((item: { readonly id: string }) => item.id === "tx_uncategorized"));

  const otherAccountResponse = await app.request("/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&accountId=bank_eur&limit=10", {
    headers: authHeaders()
  });
  const otherAccountPage = await otherAccountResponse.json();
  assert.equal(otherAccountPage.items.length, 0);
});

test("Office transactions honor from/to compatibility query parameters", async () => {
  const app = createFixtureApiService();

  const response = await app.request(
    "/eof/v1/transactions?workspaceId=workspace_1&from=2026-02-01&to=2026-02-28&limit=100",
    { headers: authHeaders() }
  );
  assert.equal(response.status, 200);
  const page = await response.json() as {
    readonly items: readonly { readonly occurredOn: string }[];
  };
  assert.ok(page.items.length > 0);
  assert.ok(page.items.every((row) => row.occurredOn >= "2026-02-01" && row.occurredOn <= "2026-02-28"));
});

test("Office bank raw honors from/to compatibility query parameters", async () => {
  const app = createFixtureApiService();

  const response = await app.request(
    "/eof/v1/bank/raw?workspaceId=workspace_1&from=2026-02-01&to=2026-02-28&limit=100",
    { headers: authHeaders() }
  );
  assert.equal(response.status, 200);
  const page = await response.json() as {
    readonly items: readonly { readonly occurredOn: string }[];
  };
  assert.ok(page.items.length > 0);
  assert.ok(page.items.every((row) => row.occurredOn >= "2026-02-01" && row.occurredOn <= "2026-02-28"));
});

test("Projects list defaults to all-history totals when period/range is omitted", async () => {
  const app = createFixtureApiService();

  const response = await app.request("/eof/v1/projects?workspaceId=workspace_1", {
    headers: authHeaders()
  });
  assert.equal(response.status, 200);
  const page = await response.json() as {
    readonly items: readonly {
      readonly id: string;
      readonly periodIncomeMicro: string;
      readonly periodExpenseMicro: string;
      readonly netMicro: string;
    }[];
  };
  const kaya = page.items.find((item) => item.id === "project_kaya");
  assert.notEqual(kaya, undefined);
  assert.equal(kaya.periodIncomeMicro, "5000.00");
  assert.equal(kaya.periodExpenseMicro, "1200.00");
  assert.equal(kaya.netMicro, "3800.00");
});

test("Bank import preview warns when file profile mismatches selected account bank", async () => {
  const fixture = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixture,
      office: {
        ...fixture.office,
        bankAccounts: [
          ...fixture.office.bankAccounts,
          {
            id: "bank_sbi",
            workspaceId: "workspace_1",
            bankName: "State Bank of Mauritius",
            accountLabel: "SBI Current",
            accountReferenceHash: "sbi-current",
            currency: "MUR",
            currentBalanceMinor: 0n,
            currentBalanceMurMinor: 0n,
            isActive: true,
            balanceAsOf: null
          }
        ]
      }
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const response = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "pdf",
      fileName: "mismatch.pdf",
      checksum: "mismatch-pdf",
      rows: [
        {
          accountId: "bank_sbi",
          occurredOn: "2026-02-11",
          description: "IB Own Account Transfer FT26107LWQWP",
          debit: "100.00",
          currency: "MUR",
          transactionDetails: "TRANS DATE VALUE DATE TRANSACTION DETAILS Mauritius Commercial Bank"
        }
      ]
    })
  });

  assert.equal(response.status, 200);
  const preview = await response.json() as { readonly warnings: readonly string[] };
  assert.ok(preview.warnings.some((warning) => warning.includes("Bank profile mismatch")));
});

test("Office screen bundle returns every section in one response matching the standalone endpoints", async () => {
  const app = createFixtureApiService();
  const response = await app.request(
    "/eof/v1/screen/office?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-28",
    { headers: authHeaders() }
  );
  assert.equal(response.status, 200);
  const screen = (await response.json()) as {
    readonly status: { readonly writesEnabled: boolean };
    readonly dashboard: { readonly period: string };
    readonly globalPnl: { readonly incomeMicro: string };
    readonly divisionPnl: { readonly items: readonly unknown[] };
    readonly planComptable: readonly unknown[];
    readonly transactions: { readonly items: readonly { readonly id: string }[] };
    readonly pendingTransactions: { readonly items: readonly { readonly id: string }[] };
    readonly reconciliations: { readonly items: readonly unknown[] };
    readonly cashflow: readonly unknown[];
    readonly auditLog: { readonly items: readonly unknown[] };
    readonly bankAccounts: { readonly items: readonly { readonly id: string }[] };
  };
  assert.equal(typeof screen.status.writesEnabled, "boolean");
  assert.equal(screen.dashboard.period, "2026-02");
  assert.equal(typeof screen.globalPnl.incomeMicro, "string");
  assert.ok(screen.planComptable.length > 0);
  assert.ok(screen.transactions.items.some((item) => item.id === "tx_mcb_fee"));
  assert.ok(screen.pendingTransactions.items.some((item) => item.id === "tx_uncategorized"));
  assert.ok(screen.bankAccounts.items.some((item) => item.id === "bank_mur"));

  const direct = await app.request(
    "/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-28&limit=100",
    { headers: authHeaders() }
  );
  const directPage = (await direct.json()) as { readonly items: readonly { readonly id: string }[] };
  assert.deepEqual(
    screen.transactions.items.map((item) => item.id),
    directPage.items.map((item) => item.id)
  );
});

test("Office screen bundle rejects unauthenticated calls", async () => {
  const app = createFixtureApiService();
  const response = await app.request(
    "/eof/v1/screen/office?workspaceId=workspace_1&period=2026-02&dateFrom=2026-02-01&dateTo=2026-02-28"
  );
  assert.equal(response.status, 401);
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

test("distribution aliases create persists a new alias and exposes it in the read list", async () => {
  const app = createWriteEnabledFixtureApiService();

  const create = await app.request("/erh/v1/aliases", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-alias-create-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      aliasText: "Alma Legacy",
      targetType: "payee",
      targetId: "payee_alma"
    })
  });
  assert.equal(create.status, 200);
  const receipt = (await create.json()) as {
    readonly id: string;
    readonly auditEventId: string | null;
    readonly alias: {
      readonly id: string;
      readonly aliasText: string;
      readonly targetType: "artist" | "payee" | "label" | "release" | "track" | "unassigned";
      readonly target: string;
      readonly targetId: string | null;
    };
  };
  assert.ok(receipt.id.length > 0);
  assert.ok(receipt.auditEventId !== null);
  assert.equal(receipt.alias.aliasText, "Alma Legacy");
  assert.equal(receipt.alias.targetType, "payee");
  assert.equal(receipt.alias.targetId, "payee_alma");
  assert.equal(receipt.alias.target, "Alma");

  const listed = await app.request("/erh/v1/aliases?workspaceId=workspace_1&limit=100", {
    headers: authHeaders()
  });
  assert.equal(listed.status, 200);
  const page = (await listed.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly aliasText: string;
      readonly targetType: string;
      readonly targetId: string | null;
    }[];
  };
  const createdAlias = page.items.find((item) => item.id === receipt.id);
  assert.ok(createdAlias !== undefined);
  assert.equal(createdAlias?.aliasText, "Alma Legacy");
  assert.equal(createdAlias?.targetType, "payee");
  assert.equal(createdAlias?.targetId, "payee_alma");
});

test("distribution aliases patch updates an existing alias target", async () => {
  const app = createWriteEnabledFixtureApiService();

  const created = await app.request("/erh/v1/aliases", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-alias-patch-create-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      aliasText: "Legacy Seggae",
      targetType: "unassigned",
      targetId: null
    })
  });
  assert.equal(created.status, 200);
  const createdReceipt = (await created.json()) as {
    readonly id: string;
  };

  const updated = await app.request(`/erh/v1/aliases/${createdReceipt.id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-alias-patch-update-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      aliasText: "Legacy Seggae",
      targetType: "track",
      targetId: "track_1"
    })
  });
  assert.equal(updated.status, 200);
  const updatedReceipt = (await updated.json()) as {
    readonly id: string;
    readonly auditEventId: string | null;
    readonly alias: {
      readonly targetType: string;
      readonly targetId: string | null;
      readonly target: string;
    };
  };
  assert.equal(updatedReceipt.id, createdReceipt.id);
  assert.ok(updatedReceipt.auditEventId !== null);
  assert.equal(updatedReceipt.alias.targetType, "track");
  assert.equal(updatedReceipt.alias.targetId, "track_1");
  assert.equal(updatedReceipt.alias.target, "Seggae light");
});

test("distribution duplicate resolve excludes duplicate earning rows", async () => {
  const app = createWriteEnabledFixtureApiService();

  const before = await app.request("/erh/v1/duplicates?workspaceId=workspace_1&limit=100", {
    headers: authHeaders()
  });
  assert.equal(before.status, 200);
  const beforePage = (await before.json()) as {
    readonly items: readonly { readonly id: string }[];
  };
  assert.ok(beforePage.items.some((item) => item.id === "MUAAA2600001"));

  const resolve = await app.request("/erh/v1/duplicates/MUAAA2600001/resolve", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-duplicate-resolve-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      keepEarningId: "earning_matched",
      reason: "manual_duplicate_review"
    })
  });
  assert.equal(resolve.status, 200);
  const receipt = (await resolve.json()) as {
    readonly duplicateId: string;
    readonly keepEarningId: string;
    readonly resolvedEarningIds: readonly string[];
    readonly auditEventId: string | null;
  };
  assert.equal(receipt.duplicateId, "MUAAA2600001");
  assert.equal(receipt.keepEarningId, "earning_matched");
  assert.ok(receipt.resolvedEarningIds.includes("earning_pending"));
  assert.ok(receipt.auditEventId !== null);

  const after = await app.request("/erh/v1/duplicates?workspaceId=workspace_1&limit=100", {
    headers: authHeaders()
  });
  assert.equal(after.status, 200);
  const afterPage = (await after.json()) as {
    readonly items: readonly { readonly id: string }[];
  };
  assert.equal(afterPage.items.some((item) => item.id === "MUAAA2600001"), false);
});

test("distribution reconciliation maintenance actions execute only through maintenance ids", async () => {
  const app = createWriteEnabledFixtureApiService();

  const maintenanceAction = await app.request("/erh/v1/financial-reconciliation/actions/recompute-payee-balance", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-reconciliation-maintenance-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      reason: "sync_payee_ledger"
    })
  });
  assert.equal(maintenanceAction.status, 200);
  const maintenanceReceipt = (await maintenanceAction.json()) as {
    readonly actionId: string;
    readonly auditEventId: string | null;
    readonly details: {
      readonly executed: boolean;
      readonly maintenance: boolean;
      readonly adjustmentCount?: number;
    };
  };
  assert.equal(maintenanceReceipt.actionId, "recompute-payee-balance");
  assert.ok(maintenanceReceipt.auditEventId !== null);
  assert.equal(maintenanceReceipt.details.executed, true);
  assert.equal(maintenanceReceipt.details.maintenance, true);
  assert.ok((maintenanceReceipt.details.adjustmentCount ?? 0) >= 1);

  const nonMaintenanceAction = await app.request("/erh/v1/financial-reconciliation/actions/link-statement-payment", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-reconciliation-maintenance-2" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      reason: null
    })
  });
  assert.equal(nonMaintenanceAction.status, 409);
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

test("Bank accounts derive balance from latest bank line when snapshot is missing", async () => {
  const fixture = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixture,
      office: {
        ...fixture.office,
        bankAccounts: fixture.office.bankAccounts.map((account) =>
          account.id === "bank_mur"
            ? {
                ...account,
                workspaceId: "eeee-mu",
                currentBalanceMinor: 0n,
                currentBalanceMurMinor: null,
                balanceAsOf: null
              }
            : {
                ...account,
                workspaceId: "eeee-mu"
              }
        )
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
      readonly currentBalanceMicro: string;
      readonly currentBalanceMurMicro: string | null;
      readonly balanceAsOf: string | null;
    }[];
  };
  const account = page.items.find((item) => item.id === "bank_mur");
  assert.equal(account?.currentBalanceMicro, "3715.00");
  assert.equal(account?.currentBalanceMurMicro, "3715.00");
  assert.equal(account?.balanceAsOf, "2026-02-15");
});

test("Bank accounts derive balance from signed movement when line balances are missing", async () => {
  const fixture = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixture,
      office: {
        ...fixture.office,
        bankAccounts: fixture.office.bankAccounts.map((account) =>
          account.id === "bank_mur"
            ? {
                ...account,
                workspaceId: "eeee-mu",
                currentBalanceMinor: 0n,
                currentBalanceMurMinor: 0n,
                balanceAsOf: null
              }
            : {
                ...account,
                workspaceId: "eeee-mu"
              }
        ),
        bankStatementLines: fixture.office.bankStatementLines.map((line) =>
          line.accountId === "bank_mur"
            ? {
                ...line,
                balanceMinor: null,
                balanceMurMinor: null
              }
            : line
        )
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
      readonly currentBalanceMicro: string;
      readonly currentBalanceMurMicro: string | null;
      readonly balanceAsOf: string | null;
    }[];
  };
  const account = page.items.find((item) => item.id === "bank_mur");
  assert.equal(account?.currentBalanceMicro, "3715.00");
  assert.equal(account?.currentBalanceMurMicro, "3715.00");
  assert.equal(account?.balanceAsOf, "2026-02-15");
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

  // An office-role user (e.g. Sophie via office@eeee.mu) can cancel/correct her own entries.
  const officeCancel = await app.request(`/eof/v1/transactions/${transactionCreate.id}/cancel`, {
    method: "PATCH",
    headers: {
      ...authHeadersForToken("fixture-office-token"),
      "Content-Type": "application/json",
      "Idempotency-Key": "office-transaction-cancel"
    },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(officeCancel.status, 200);
  assertReceipt(await officeCancel.json());

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

  const bankAccountCreate = await jsonWrite(app, "/eof/v1/bank/accounts", "POST", "activated-bank-account-create", {
    workspaceId: "workspace_1",
    bankName: "MCB",
    accountLabel: "MCB EUR",
    currency: "EUR",
    active: true
  });
  assertReceipt(bankAccountCreate);
  assertReceipt(await jsonWrite(app, `/eof/v1/bank/accounts/${bankAccountCreate.id}`, "PATCH", "activated-bank-account-update", {
    workspaceId: "workspace_1",
    bankName: "MCB",
    accountLabel: "MCB EUR (renamed)",
    currency: "EUR",
    active: false
  }));

  const projectCreate = await jsonWrite(app, "/eof/v1/projects", "POST", "activated-project-create", {
    workspaceId: "workspace_1",
    name: "Activated Project",
    status: "active",
    description: null,
    active: true
  });
  assertReceipt(projectCreate);
  assertReceipt(await jsonWrite(app, `/eof/v1/projects/${projectCreate.id}`, "PATCH", "activated-project-update", {
    workspaceId: "workspace_1",
    name: "Activated Project Updated",
    status: "completed",
    description: "Wrapped up",
    active: true
  }));

  const cashflowRows = [
    { periodMonth: "2026-07", inflow: "1000.00", outflow: "400.00", closingBalance: "600.00", currency: "MUR" }
  ];
  const cashflowPreview = await jsonWrite(app, "/eof/v1/cashflow/preview", "POST", "activated-cashflow-preview", {
    workspaceId: "workspace_1",
    rows: cashflowRows
  });
  assert.equal(cashflowPreview.acceptedRowCount, 1);
  assert.equal(cashflowPreview.rejectedRowCount, 0);
  assertReceipt(await jsonWrite(app, "/eof/v1/cashflow/confirm", "POST", "activated-cashflow-confirm", {
    workspaceId: "workspace_1",
    rows: cashflowRows
  }));

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

test("plan-comptable delete removes unreferenced nodes and blocks referenced categories", async () => {
  const app = createWriteEnabledFixtureApiService();

  const nodeCreate = await jsonWrite(app, "/eof/v1/plan-comptable", "POST", "plan-delete-create", {
    workspaceId: "workspace_1",
    parentId: "div_admin",
    kind: "category",
    code: "DEL",
    label: "Delete me",
    active: true,
    type: "expense"
  });
  assertReceipt(nodeCreate);
  assert.ok((nodeCreate.id ?? "").length > 0);

  const deleteCreated = await app.request(`/eof/v1/plan-comptable/${nodeCreate.id}`, {
    method: "DELETE",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "plan-delete-created" },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(deleteCreated.status, 200);
  assertReceipt(await deleteCreated.json());

  const planAfterDeleteResponse = await app.request("/eof/v1/plan-comptable?workspaceId=workspace_1&includeInactive=true", {
    headers: authHeaders()
  });
  assert.equal(planAfterDeleteResponse.status, 200);
  const planAfterDelete = (await planAfterDeleteResponse.json()) as readonly { readonly id: string }[];
  assert.equal(planAfterDelete.some((node) => node.id === nodeCreate.id), false);

  const deleteReferenced = await app.request("/eof/v1/plan-comptable/cat_bank_fee", {
    method: "DELETE",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "plan-delete-referenced" },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(deleteReferenced.status, 409);
  const blocked = (await deleteReferenced.json()) as {
    readonly error: {
      readonly code: string;
      readonly context: readonly string[];
    };
  };
  assert.equal(blocked.error.code, "office_plan_node_has_dependencies");
  assert.ok(blocked.error.context.some((entry) => entry === "transactionCount=1"));
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

test("payment void sets status voided, restores the balance, replays idempotently, and denies double void", async () => {
  const app = createWriteEnabledFixtureApiService();
  const record = await app.request("/erh/v1/payments", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-void-record-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      statementId: "statement_alma",
      payeeId: "payee_alma",
      amountMicro: "5.0000000000",
      currency: "USD",
      paidAt: "2026-06-21T10:00:00.000Z",
      reference: "PAY-VOID-TARGET"
    })
  });
  assert.equal(record.status, 200);
  const receipt = (await record.json()) as PaymentReceipt;
  assert.equal(receipt.statementBalance.paymentsApplied, "20.1000000000");

  const voidBody = { workspaceId: "workspace_1", reason: "duplicate payment" };
  const voided = await app.request(`/erh/v1/payments/${receipt.paymentId}/void`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-void-memory-1" },
    body: JSON.stringify(voidBody)
  });
  assert.equal(voided.status, 200);
  const voidReceipt = (await voided.json()) as PaymentReceipt;
  assert.equal(voidReceipt.paymentStatus, "voided");
  assert.ok(voidReceipt.auditEventId !== null);
  assert.equal(voidReceipt.statementBalance.paymentsApplied, "15.1000000000");
  assert.equal(voidReceipt.statementBalance.statementBalance, "44.9000000000");

  const replay = await app.request(`/erh/v1/payments/${receipt.paymentId}/void`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-void-memory-1" },
    body: JSON.stringify(voidBody)
  });
  assert.equal(replay.status, 200);
  const replayReceipt = (await replay.json()) as PaymentReceipt;
  assert.equal(replayReceipt.paymentId, receipt.paymentId);
  assert.equal(replayReceipt.paymentStatus, "voided");

  const doubleVoid = await app.request(`/erh/v1/payments/${receipt.paymentId}/void`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "payment-void-memory-2" },
    body: JSON.stringify({ workspaceId: "workspace_1", reason: "void twice" })
  });
  assert.equal(doubleVoid.status, 409);

  const viewerDenied = await app.request(`/erh/v1/payments/${receipt.paymentId}/void`, {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-viewer-token"), "Content-Type": "application/json", "Idempotency-Key": "payment-void-viewer-1" },
    body: JSON.stringify(voidBody)
  });
  assert.equal(viewerDenied.status, 403);

  const payments = await app.request("/erh/v1/payments?workspaceId=workspace_1&payeeId=payee_alma&limit=10", {
    headers: authHeaders()
  });
  assert.equal(payments.status, 200);
  const paymentPage = (await payments.json()) as { readonly items: readonly { readonly id: string; readonly status: string }[] };
  assert.equal(paymentPage.items.find((item) => item.id === receipt.paymentId)?.status, "voided");
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
      rows: [{ date: "2026-02-20", description: "Viewer row", debit: "1.00", currency: "MUR", accountId: "bank_mur" }]
    })
  });
  assert.equal(viewerPreview.status, 403);

  // The office role (e.g. office@eeee.mu / Sophie) must be able to import bank statements —
  // it is the core office task, not an admin-only action.
  const officePreview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-office-token"), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank.csv",
      checksum: "checksum-bank-preview-office",
      rows: [{ date: "2026-02-20", description: "Office row", debit: "1.00", currency: "MUR", accountId: "bank_mur" }]
    })
  });
  assert.equal(officePreview.status, 200);

  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank.csv",
      checksum: "checksum-bank-preview-admin",
      rows: [{ date: "2026-02-20", description: "Admin row", debit: "1.00", currency: "MUR", accountId: "bank_mur" }]
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

test("bank import parse-preview parses CSV rows server-side and enforces preview permissions", async () => {
  const app = createDisabledFixtureApiService();
  const csv = [
    "Date,Description,Debit,Credit,Currency,Reference",
    "05/27/2026,CHARGES FOR BILL I,40.00,,MUR,REF-1",
    "05/28/2026,PAYMENT RECEIVED,,125.00,MUR,REF-2"
  ].join("\n");

  const viewerParse = await app.request("/eof/v1/bank-import/parse-preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-viewer-token"), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      fileName: "bank.csv",
      sourceHint: "csv",
      contentText: csv
    })
  });
  assert.equal(viewerParse.status, 403);

  const officeParse = await app.request("/eof/v1/bank-import/parse-preview", {
    method: "POST",
    headers: { ...authHeadersForToken("fixture-office-token"), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      fileName: "bank.csv",
      sourceHint: "csv",
      contentText: csv
    })
  });
  assert.equal(officeParse.status, 200);
  const json = (await officeParse.json()) as {
    readonly source: string;
    readonly currency: string;
    readonly parsedRowCount: number;
    readonly rows: readonly Readonly<Record<string, string>>[];
  };
  assert.equal(json.source, "csv");
  assert.equal(json.currency, "MUR");
  assert.equal(json.parsedRowCount, 2);
  assert.equal(json.rows.length, 2);
  assert.equal(json.rows[0]?.transactionDate, "2026-05-27");
  assert.equal(json.rows[0]?.debit, "40.00");
  assert.equal(json.rows[1]?.credit, "125.00");
});

// Regression for the SBI MUR import that rejected all 2652 rows with no visible reason: when
// no target account resolves (here a currency with no matching account, mirroring rows sent
// without an accountId), every row is rejected and the cause must be surfaced — not swallowed.
test("bank import preview surfaces account_not_found when no target account resolves", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "sbi.csv",
      checksum: "checksum-bank-preview-no-account",
      rows: [
        { date: "2026-05-27", description: "CHARGES FOR BILL I", debit: "40.00", currency: "USD" },
        { date: "2026-05-26", description: "IO-ELECTR-RASNATTM", debit: "50000.00", currency: "USD" }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const json = (await preview.json()) as {
    readonly acceptedRowCount: number;
    readonly rejectedRowCount: number;
    readonly rejectionReasons: readonly { readonly reason: string; readonly count: number }[];
    readonly rowResults: readonly { readonly id: string; readonly status: string; readonly issues: readonly string[] }[];
  };
  assert.equal(json.acceptedRowCount, 0);
  assert.equal(json.rejectedRowCount, 2);
  const accountReason = json.rejectionReasons.find((entry) => entry.reason === "account_not_found");
  assert.ok(accountReason !== undefined, "expected account_not_found to be surfaced in rejectionReasons");
  assert.equal(accountReason?.count, 2);
  // Per-row results drive the import table: both rows present, both rejected, each carrying its reason.
  assert.equal(json.rowResults.length, 2);
  assert.ok(json.rowResults.every((row) => row.status === "rejected"));
  assert.ok(json.rowResults.every((row) => row.issues.includes("account_not_found")));
});

test("bank import preview rejects foreign rows when no FX rate can convert to MUR", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "eur-missing-rate.csv",
      checksum: "checksum-bank-preview-missing-fx",
      rows: [
        {
          date: "2026-05-27",
          description: "Foreign row without FX",
          debit: "40.00",
          currency: "USD",
          accountId: "bank_eur"
        }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const json = (await preview.json()) as {
    readonly acceptedRowCount: number;
    readonly rejectedRowCount: number;
    readonly rejectionReasons: readonly { readonly reason: string; readonly count: number }[];
    readonly rowResults: readonly { readonly id: string; readonly status: string; readonly issues: readonly string[] }[];
  };
  assert.equal(json.acceptedRowCount, 0);
  assert.equal(json.rejectedRowCount, 1);
  const fxReason = json.rejectionReasons.find((entry) => entry.reason === "amount_mur_missing_for_foreign_currency");
  assert.ok(fxReason !== undefined, "expected missing FX rejection reason to be surfaced");
  assert.equal(fxReason?.count, 1);
  assert.equal(json.rowResults.length, 1);
  assert.equal(json.rowResults[0]?.status, "rejected");
  assert.ok(json.rowResults[0]?.issues.includes("amount_mur_missing_for_foreign_currency"));
});

async function reconciliationLineStatus(
  app: ReturnType<typeof createApiService>,
  statementLineId: string
): Promise<{ readonly status: string; readonly transactionId: string } | undefined> {
  const response = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1", { headers: authHeaders() });
  assert.equal(response.status, 200);
  const page = (await response.json()) as {
    readonly items: readonly { readonly statementLineId: string; readonly status: string; readonly transactionId: string }[];
  };
  return page.items.find((item) => item.statementLineId === statementLineId);
}

test("classification files a transaction without flipping its income/expense type", async () => {
  const app = createWriteEnabledFixtureApiService();
  const created = await jsonWrite(app, "/eof/v1/transactions", "POST", "type-keep-create", {
    workspaceId: "workspace_1",
    occurredOn: "2026-02-22",
    accountId: "bank_mur",
    categoryId: null,
    projectId: null,
    description: "Performance fee collected",
    amountMicro: "150.00",
    currency: "MUR",
    type: "income"
  });
  assertReceipt(created);

  // Filing under an expense-typed category must not rewrite the transaction type.
  assertReceipt(await jsonWrite(app, `/eof/v1/transactions/${created.id}`, "PATCH", "type-keep-classify", {
    workspaceId: "workspace_1",
    occurredOn: "2026-02-22",
    accountId: "bank_mur",
    categoryId: "cat_rental_expense",
    projectId: null,
    description: "Performance fee collected",
    amountMicro: "150.00",
    currency: "MUR"
  }));

  const page = await app.request("/eof/v1/transactions?workspaceId=workspace_1&limit=100", { headers: authHeaders() });
  assert.equal(page.status, 200);
  const transactions = (await page.json()) as {
    readonly items: readonly { readonly id: string; readonly type: string; readonly categoryId: string | null }[];
  };
  const classified = transactions.items.find((item) => item.id === created.id);
  assert.ok(classified !== undefined);
  assert.equal(classified.categoryId, "cat_rental_expense");
  assert.equal(classified.type, "income", `classification flipped the type to ${classified.type}`);
});

test("transaction create without explicit type uses fixed fallback independent of category", async () => {
  const app = createWriteEnabledFixtureApiService();

  const firstCreate = await app.request("/eof/v1/transactions", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "type-missing-create-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      occurredOn: "2026-02-22",
      accountId: "bank_mur",
      categoryId: "cat_rental_expense",
      projectId: null,
      description: "Missing explicit type",
      amountMicro: "150.00",
      currency: "MUR"
    })
  });
  assert.equal(firstCreate.status, 200);
  const firstReceipt = (await firstCreate.json()) as { readonly id: string };

  const secondCreate = await app.request("/eof/v1/transactions", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "type-missing-create-2" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      occurredOn: "2026-02-23",
      accountId: "bank_mur",
      categoryId: "cat_live_income",
      projectId: null,
      description: "Missing explicit type with income category",
      amountMicro: "42.00",
      currency: "MUR"
    })
  });
  assert.equal(secondCreate.status, 200);
  const secondReceipt = (await secondCreate.json()) as { readonly id: string };

  const page = await app.request("/eof/v1/transactions?workspaceId=workspace_1&limit=200", { headers: authHeaders() });
  assert.equal(page.status, 200);
  const transactions = (await page.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly type: string;
      readonly categoryId: string | null;
    }[];
  };

  const first = transactions.items.find((item) => item.id === firstReceipt.id);
  assert.ok(first !== undefined);
  assert.equal(first.type, "expense");
  assert.equal(first.categoryId, "cat_rental_expense");

  const second = transactions.items.find((item) => item.id === secondReceipt.id);
  assert.ok(second !== undefined);
  assert.equal(second.type, "expense");
  assert.equal(second.categoryId, "cat_live_income");
});

test("reconciliation candidates sign bank amounts by direction", async () => {
  const app = createFixtureApiService();
  const response = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1", { headers: authHeaders() });
  assert.equal(response.status, 200);
  const page = (await response.json()) as {
    readonly items: readonly { readonly statementLineId: string; readonly amountMicro: string; readonly bankDescription: string }[];
  };
  const debit = page.items.find((item) => item.statementLineId === "bank_line_unmatched");
  assert.ok(debit !== undefined);
  assert.ok(debit.amountMicro.startsWith("-"), `debit line must be negative, got ${debit.amountMicro}`);
  const credit = page.items.find((item) => item.statementLineId === "bank_line_income");
  assert.ok(credit !== undefined);
  assert.ok(!credit.amountMicro.startsWith("-"), `credit line must stay positive, got ${credit.amountMicro}`);
  // The fixture line has both a description and a non-empty reference (INV-BED-1):
  // the CSV description must win over the reference/cheque number.
  assert.equal(credit.bankDescription, "Fixture income");
});

test("bank import delete is administrator-only and permanently removes the batch's lines", async () => {
  const app = createWriteEnabledFixtureApiService();

  const denied = await app.request("/eof/v1/bank-import/batches/office_import_mcb_feb/delete", {
    method: "POST",
    headers: {
      ...authHeadersForToken("fixture-office-token"),
      "Content-Type": "application/json",
      "Idempotency-Key": "import-delete-denied"
    },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(denied.status, 403);

  const beforeRaw = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1&accountId=bank_mur", { headers: authHeaders() });
  const beforeRawBody = (await beforeRaw.json()) as { readonly items: readonly { readonly id: string }[] };
  assert.ok(beforeRawBody.items.some((item) => item.id === "bank_line_unmatched"));

  assertReceipt(await jsonWrite(app, "/eof/v1/bank-import/batches/office_import_mcb_feb/delete", "POST", "import-delete-1", {
    workspaceId: "workspace_1"
  }));

  const afterRaw = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1&accountId=bank_mur", { headers: authHeaders() });
  const afterRawBody = (await afterRaw.json()) as { readonly items: readonly { readonly id: string }[] };
  assert.ok(!afterRawBody.items.some((item) => item.id === "bank_line_unmatched"), "deleted batch's lines must no longer appear in bank/raw");

  const afterReconciliations = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1", { headers: authHeaders() });
  const afterReconciliationsBody = (await afterReconciliations.json()) as { readonly items: readonly { readonly statementLineId: string }[] };
  assert.ok(
    !afterReconciliationsBody.items.some((item) => item.statementLineId === "bank_line_unmatched"),
    "deleted batch's lines must no longer appear in reconciliation candidates"
  );

  const secondDelete = await app.request("/eof/v1/bank-import/batches/office_import_mcb_feb/delete", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "import-delete-2" },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(secondDelete.status, 404, "the batch is already gone, so a fresh delete request must 404");
});

test("reconciliation manual match, unmatch, and reject flip the bank line status", async () => {
  const app = createWriteEnabledFixtureApiService();
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "unmatched");

  assertReceipt(await jsonWrite(app, "/eof/v1/reconciliations/match", "POST", "recon-match-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched",
    transactionId: "tx_uncategorized",
    matchedAt: "2026-02-20T10:00:00.000Z"
  }));
  const matched = await reconciliationLineStatus(app, "bank_line_unmatched");
  assert.equal(matched?.status, "matched");
  assert.equal(matched?.transactionId, "tx_uncategorized");

  assertReceipt(await jsonWrite(app, "/eof/v1/reconciliations/unmatch", "POST", "recon-unmatch-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched"
  }));
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "unmatched");

  assertReceipt(await jsonWrite(app, "/eof/v1/reconciliations/reject", "POST", "recon-reject-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched"
  }));
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "rejected");
});

test("reconciliation manual match rejects amount mismatches", async () => {
  const app = createWriteEnabledFixtureApiService();
  const response = await app.request("/eof/v1/reconciliations/match", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "recon-mismatch-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      statementLineId: "bank_line_unmatched",
      transactionId: "tx_mcb_fee",
      matchedAt: "2026-02-20T10:00:00.000Z"
    })
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "office_reconciliation_amount_mismatch");
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "unmatched");
});

test("reconciliation ignore marks a bank line ignored and distinct from rejected", async () => {
  const app = createWriteEnabledFixtureApiService();
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "unmatched");

  assertReceipt(await jsonWrite(app, "/eof/v1/reconciliations/ignore", "POST", "recon-ignore-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched"
  }));
  assert.equal((await reconciliationLineStatus(app, "bank_line_unmatched"))?.status, "ignored");
});

test("bank raw line reassign-account moves a line to a different bank account", async () => {
  const app = createWriteEnabledFixtureApiService();
  const before = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1", { headers: authHeaders() });
  const beforeLine = ((await before.json()) as { readonly items: readonly { readonly id: string; readonly accountId: string }[] }).items.find(
    (item) => item.id === "bank_line_unmatched"
  );
  assert.equal(beforeLine?.accountId, "bank_mur");

  assertReceipt(await jsonWrite(app, "/eof/v1/bank/raw/reassign-account", "POST", "recon-reassign-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched",
    accountId: "bank_eur"
  }));

  const after = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1", { headers: authHeaders() });
  const afterLine = ((await after.json()) as { readonly items: readonly { readonly id: string; readonly accountId: string }[] }).items.find(
    (item) => item.id === "bank_line_unmatched"
  );
  assert.equal(afterLine?.accountId, "bank_eur");
});

test("bank raw line reassign-account rejects a nonexistent target account", async () => {
  const app = createWriteEnabledFixtureApiService();
  const response = await app.request("/eof/v1/bank/raw/reassign-account", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "recon-reassign-bad-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      statementLineId: "bank_line_unmatched",
      accountId: "bank_does_not_exist"
    })
  });
  assert.equal(response.status, 404);
});

test("reconciliation create-transaction builds a ledger line from a bank line and matches it", async () => {
  const app = createWriteEnabledFixtureApiService();
  const receipt = await jsonWrite(app, "/eof/v1/reconciliations/create-transaction", "POST", "recon-create-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_unmatched",
    categoryId: null,
    projectId: null,
    matchedAt: "2026-02-20T10:00:00.000Z"
  });
  assertReceipt(receipt);
  const candidate = await reconciliationLineStatus(app, "bank_line_unmatched");
  assert.equal(candidate?.status, "matched");
  assert.equal(candidate?.transactionId, receipt.id);
});

test("reconciliation create-transaction normalizes EUR bank lines to MUR for persisted transaction currency", async () => {
  const fixtures = createFixtureStore();
  const baseLine = fixtures.office.bankStatementLines.find((line) => line.id === "bank_line_unmatched");
  assert.ok(baseLine !== undefined);
  const eurLine = {
    ...baseLine,
    id: "bank_line_eur_unmatched",
    accountId: "bank_eur",
    occurredOn: "2026-02-16",
    description: "Fixture EUR unmatched",
    reference: "EUR-UNMATCHED",
    direction: "debit" as const,
    amountMinor: 1_000n,
    balanceMinor: 1_000n,
    currency: "EUR",
    amountMurMinor: 51_000n,
    balanceMurMinor: 51_000n,
    isDuplicateCandidate: false,
    reconciliationStatus: "unmatched" as const,
    matchedTransactionId: null,
    rawData: {}
  };
  const app = createWriteEnabledFixtureApiServiceWithOverrides({
    office: {
      ...fixtures.office,
      bankStatementLines: [eurLine],
      bankReconciliationMatches: []
    }
  });

  const receipt = await jsonWrite(app, "/eof/v1/reconciliations/create-transaction", "POST", "recon-create-eur-1", {
    workspaceId: "workspace_1",
    statementLineId: "bank_line_eur_unmatched",
    categoryId: null,
    projectId: null,
    matchedAt: "2026-02-20T10:00:00.000Z"
  });
  assertReceipt(receipt);

  const line = await reconciliationLineStatus(app, "bank_line_eur_unmatched");
  assert.equal(line?.status, "matched");
  assert.equal(line?.transactionId, receipt.id);

  const transactionsResponse = await app.request(
    "/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&accountId=bank_eur&limit=50",
    { headers: authHeaders() }
  );
  assert.equal(transactionsResponse.status, 200);
  const transactions = (await transactionsResponse.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly amountMicro: string;
      readonly currency: string;
      readonly type: string;
      readonly accountId: string | null;
    }[];
  };
  const created = transactions.items.find((item) => item.id === receipt.id);
  assert.ok(created !== undefined);
  assert.equal(created?.amountMicro, "510.00");
  assert.equal(created?.currency, "MUR");
  assert.equal(created?.type, "expense");
  assert.equal(created?.accountId, "bank_eur");
});

test("VAT report is empty when no VAT source metadata exists", async () => {
  const app = createFixtureApiService();
  const response = await app.request("/eof/v1/vat?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });

  assert.equal(response.status, 200);
  const vat = (await response.json()) as {
    readonly hasVatSource: boolean;
    readonly outputVatMicro: string;
    readonly inputVatMicro: string;
    readonly netVatMicro: string;
    readonly rows: readonly unknown[];
  };
  assert.equal(vat.hasVatSource, false);
  assert.equal(vat.outputVatMicro, "0.00");
  assert.equal(vat.inputVatMicro, "0.00");
  assert.equal(vat.netVatMicro, "0.00");
  assert.equal(vat.rows.length, 0);
});

test("VAT report computes totals from transaction VAT metadata", async () => {
  const fixtures = createFixtureStore();
  const app = createApiService({
    fixtures: {
      ...fixtures,
      office: {
        ...fixtures.office,
        transactions: [
          {
            ...fixtures.office.transactions[0],
            id: "tx_vat_income",
            transactionDate: "2026-02-10T10:00:00.000Z",
            type: "income",
            status: "validated",
            isActive: true,
            amountMinor: 11_500n,
            vatApplicable: true,
            vatRateBp: 1500,
            vatAmountMinor: 1_500n
          },
          {
            ...fixtures.office.transactions[1],
            id: "tx_vat_expense",
            transactionDate: "2026-02-11T10:00:00.000Z",
            type: "expense",
            status: "validated",
            isActive: true,
            amountMinor: 23_000n,
            vatApplicable: true,
            vatRateBp: 1500,
            vatAmountMinor: 3_000n
          }
        ]
      }
    },
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createTestAuthVerifier()
  });

  const response = await app.request("/eof/v1/vat?workspaceId=workspace_1&period=2026-02", {
    headers: authHeaders()
  });

  assert.equal(response.status, 200);
  const vat = (await response.json()) as {
    readonly hasVatSource: boolean;
    readonly outputVatMicro: string;
    readonly inputVatMicro: string;
    readonly netVatMicro: string;
    readonly rows: readonly { readonly id: string; readonly rateBp: number; readonly vatMicro: string }[];
  };
  assert.equal(vat.hasVatSource, true);
  assert.equal(vat.outputVatMicro, "15.00");
  assert.equal(vat.inputVatMicro, "30.00");
  assert.equal(vat.netVatMicro, "-15.00");
  assert.equal(vat.rows.length, 2);
  assert.ok(vat.rows.every((row) => row.rateBp === 1500));
  assert.ok(vat.rows.some((row) => row.id === "tx_vat_income" && row.vatMicro === "15.00"));
  assert.ok(vat.rows.some((row) => row.id === "tx_vat_expense" && row.vatMicro === "30.00"));
});

test("ledger bulk preview resolves classified rows by name and reports unresolved ones", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/transactions/bulk-preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      rows: [
        { legacyId: 90001, occurredOn: "2026-05-27", type: "expense", amount: "40.00", currency: "MUR", description: "Bank charge", departmentName: null, divisionName: null, categoryName: "Bank fees", partnerName: null, accountCode: "6150", accountLabel: "Bank Charges", projectId: null },
        { legacyId: 90002, occurredOn: "2026-05-26", type: "expense", amount: "50.00", currency: "MUR", description: "Mystery", departmentName: null, divisionName: null, categoryName: "Ghost Category", partnerName: null, accountCode: null, accountLabel: null, projectId: null },
        { legacyId: 90003, occurredOn: "2026-05-25", type: "expense", amount: "10.00", currency: "MUR", description: "Unclassified", departmentName: null, divisionName: null, categoryName: null, partnerName: null, accountCode: null, accountLabel: null, projectId: null }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const json = (await preview.json()) as {
    readonly acceptedRowCount: number;
    readonly rejectedRowCount: number;
    readonly validatedRowCount: number;
    readonly draftRowCount: number;
    readonly rejectionReasons: readonly { readonly reason: string; readonly count: number }[];
    readonly rows: readonly { readonly legacyId: number; readonly willValidate: boolean }[];
  };
  assert.equal(json.acceptedRowCount, 2);
  assert.equal(json.rejectedRowCount, 1);
  assert.equal(json.validatedRowCount, 1);
  assert.equal(json.draftRowCount, 1);
  assert.ok(json.rejectionReasons.some((entry) => entry.reason === "category_not_found" && entry.count === 1));
  assert.equal(json.rows.find((entry) => entry.legacyId === 90001)?.willValidate, true);
  assert.equal(json.rows.find((entry) => entry.legacyId === 90003)?.willValidate, false);
});

test("ledger bulk-upsert preview accepts externalId and resolves category by account code", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/transactions/bulk-upsert/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "office",
      rows: [
        {
          externalId: 91001,
          occurredOn: "2026-05-27",
          type: "expense",
          amount: "40.00",
          currency: "MUR",
          description: "Bank charge",
          accountCode: "6150"
        }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const json = (await preview.json()) as {
    readonly acceptedRowCount: number;
    readonly rejectedRowCount: number;
    readonly validatedRowCount: number;
    readonly rows: readonly { readonly legacyId: number; readonly willValidate: boolean; readonly categoryId: string | null }[];
  };
  assert.equal(json.acceptedRowCount, 1);
  assert.equal(json.rejectedRowCount, 0);
  assert.equal(json.validatedRowCount, 1);
  assert.equal(json.rows[0]?.legacyId, 91001);
  assert.equal(json.rows[0]?.willValidate, true);
  assert.equal(json.rows[0]?.categoryId, "cat_bank_fee");
});

test("ledger bulk confirm upserts accepted rows and replays idempotently", async () => {
  const app = createWriteEnabledFixtureApiService();
  const body = {
    workspaceId: "workspace_1",
    rows: [
      { legacyId: 90001, occurredOn: "2026-05-27", type: "expense", amount: "40.00", currency: "MUR", description: "Bank charge", departmentName: null, divisionName: null, categoryName: "Bank fees", partnerName: null, accountCode: "6150", accountLabel: "Bank Charges", projectId: null },
      { legacyId: 90002, occurredOn: "2026-05-26", type: "expense", amount: "50.00", currency: "MUR", description: "Ghost", departmentName: null, divisionName: null, categoryName: "Ghost Category", partnerName: null, accountCode: null, accountLabel: null, projectId: null }
    ]
  };
  const first = await jsonWrite(app, "/eof/v1/transactions/bulk-confirm", "POST", "ledger-bulk-1", body);
  assertReceipt(first);
  assert.equal((first as { readonly upsertedRowCount: number }).upsertedRowCount, 1);
  const replay = await jsonWrite(app, "/eof/v1/transactions/bulk-confirm", "POST", "ledger-bulk-1", body);
  assert.equal((replay as { readonly upsertedRowCount: number }).upsertedRowCount, 1);
});

// Regression: the office role is (correctly) 403 on cc/v1 since the domain-authz fix, so the Office
// UI must read the write gate from the office-scoped route or it stays locked even when writes are on.
test("office reads the write gate from eof/v1/status while cc/v1 stays 403 for office", async () => {
  const app = createWriteEnabledFixtureApiService();
  const ccStatus = await app.request("/cc/v1/status?workspaceId=workspace_1", {
    headers: authHeadersForToken("fixture-office-token")
  });
  assert.equal(ccStatus.status, 403);
  const officeStatus = await app.request("/eof/v1/status?workspaceId=workspace_1", {
    headers: authHeadersForToken("fixture-office-token")
  });
  assert.equal(officeStatus.status, 200);
  assert.equal(((await officeStatus.json()) as { readonly writesEnabled: boolean }).writesEnabled, true);
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
      rows: [{ date: "2026-02-20", description: "Imported bank line", debit: "12.34", currency: "MUR", accountId: "bank_mur", reference: "IMP-1" }]
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

test("office bank import confirm creates suggested reconciliation propositions instead of auto-matching", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank-suggested.csv",
      checksum: "checksum-bank-suggested",
      rows: [
        {
          date: "2026-02-15",
          description: "Awaiting category",
          debit: "85.00",
          currency: "MUR",
          accountId: "bank_mur",
          reference: "SUG-1"
        }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string };

  const confirm = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-suggested-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      previewId: previewJson.previewId,
      acceptedRowIds: ["row_1"],
      rejectedRowIds: []
    })
  });
  assert.equal(confirm.status, 200);

  const suggested = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1&status=suggested&limit=100", {
    headers: authHeaders()
  });
  assert.equal(suggested.status, 200);
  const suggestedPage = (await suggested.json()) as {
    readonly items: readonly {
      readonly bankDescription: string;
      readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
      readonly transactionId: string;
    }[];
  };
  const row = suggestedPage.items.find((item) => item.bankDescription.includes("Awaiting category"));
  assert.ok(row !== undefined);
  assert.equal(row?.status, "suggested");
  assert.equal(row?.transactionId, "tx_uncategorized");

  const raw = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1&period=2026-02&limit=100", {
    headers: authHeaders()
  });
  assert.equal(raw.status, 200);
  const rawPage = (await raw.json()) as {
    readonly items: readonly {
      readonly reference: string;
      readonly reconciliationStatus: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
      readonly matchedTransactionId: string | null;
    }[];
  };
  const rawRow = rawPage.items.find((item) => item.reference === "SUG-1");
  assert.ok(rawRow !== undefined);
  assert.equal(rawRow?.reconciliationStatus, "suggested");
  assert.equal(rawRow?.matchedTransactionId, null);
});

test("office reconciliation operations reports actionable reconciliation KPIs", async () => {
  const app = createFixtureApiService();

  const response = await app.request(
    "/eof/v1/reconciliations/operations?workspaceId=workspace_1&period=2026-02",
    { headers: authHeaders() }
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    readonly workspaceId: string;
    readonly totalCount: number;
    readonly unmatchedCount: number;
    readonly suggestedCount: number;
    readonly matchedCount: number;
    readonly rejectedCount: number;
    readonly ignoredCount: number;
    readonly autoApprovableCount: number;
    readonly staleSuggestedCount: number;
    readonly oldestUnmatchedDays: number | null;
    readonly matchedRateBp: number;
  };

  assert.equal(payload.workspaceId, "workspace_1");
  assert.equal(payload.totalCount, 3);
  assert.equal(payload.unmatchedCount, 1);
  assert.equal(payload.suggestedCount, 1);
  assert.equal(payload.matchedCount, 1);
  assert.equal(payload.rejectedCount, 0);
  assert.equal(payload.ignoredCount, 0);
  assert.equal(payload.autoApprovableCount, 1);
  assert.equal(payload.staleSuggestedCount, 1);
  assert.ok((payload.oldestUnmatchedDays ?? 0) > 0);
  assert.equal(payload.matchedRateBp, 3333);
});

test("office reconciliation approve-suggested auto-approves high-confidence suggested candidates", async () => {
  const app = createWriteEnabledFixtureApiService();

  const approve = await app.request("/eof/v1/reconciliations/approve-suggested", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "reconciliation-approve-suggested-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      approvedAt: "2026-06-21T12:00:00.000Z",
      minConfidenceBp: 9500,
      limit: 10
    })
  });
  assert.equal(approve.status, 200);

  const receipt = (await approve.json()) as {
    readonly status: string;
    readonly processedCount: number;
    readonly candidateCount: number;
    readonly auditEventId: string | null;
  };
  assert.equal(receipt.status, "completed");
  assert.equal(receipt.processedCount, 1);
  assert.equal(receipt.candidateCount, 1);
  assert.ok(receipt.auditEventId !== null);

  const suggestedAfter = await app.request(
    "/eof/v1/reconciliations?workspaceId=workspace_1&status=suggested&period=2026-02&limit=100",
    { headers: authHeaders() }
  );
  assert.equal(suggestedAfter.status, 200);
  const suggestedAfterPage = (await suggestedAfter.json()) as { readonly items: readonly unknown[] };
  assert.equal(suggestedAfterPage.items.length, 0);

  const matchedAfter = await app.request(
    "/eof/v1/reconciliations?workspaceId=workspace_1&status=matched&period=2026-02&limit=100",
    { headers: authHeaders() }
  );
  assert.equal(matchedAfter.status, 200);
  const matchedAfterPage = (await matchedAfter.json()) as {
    readonly items: readonly {
      readonly statementLineId: string;
      readonly transactionId: string;
      readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
    }[];
  };
  assert.ok(
    matchedAfterPage.items.some(
      (item) => item.statementLineId === "bank_line_rental" && item.transactionId === "tx_bedouin_rental" && item.status === "matched"
    )
  );

  const operationsAfter = await app.request(
    "/eof/v1/reconciliations/operations?workspaceId=workspace_1&period=2026-02",
    { headers: authHeaders() }
  );
  assert.equal(operationsAfter.status, 200);
  const operationsPayload = (await operationsAfter.json()) as {
    readonly suggestedCount: number;
    readonly matchedCount: number;
    readonly autoApprovableCount: number;
  };
  assert.equal(operationsPayload.suggestedCount, 0);
  assert.equal(operationsPayload.matchedCount, 2);
  assert.equal(operationsPayload.autoApprovableCount, 0);
});

test("office bank import confirm skips ambiguous reconciliation suggestions", async () => {
  const fixtures = createFixtureStore();
  const referenceTransaction = fixtures.office.transactions.find((transaction) => transaction.id === "tx_uncategorized");
  if (referenceTransaction === undefined) {
    throw new Error("Fixture transaction tx_uncategorized is required for this test.");
  }

  const app = createWriteEnabledFixtureApiServiceWithOverrides({
    office: {
      ...fixtures.office,
      transactions: [
        ...fixtures.office.transactions,
        {
          ...referenceTransaction,
          id: "tx_uncategorized_clone"
        }
      ]
    }
  });

  const preview = await app.request("/eof/v1/bank-import/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "csv",
      fileName: "bank-suggested-ambiguous.csv",
      checksum: "checksum-bank-suggested-ambiguous",
      rows: [
        {
          date: "2026-02-15",
          description: "Awaiting category",
          debit: "85.00",
          currency: "MUR",
          accountId: "bank_mur",
          reference: "SUG-AMB-1"
        }
      ]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string };

  const confirm = await app.request("/eof/v1/bank-import/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-suggested-ambiguous-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      previewId: previewJson.previewId,
      acceptedRowIds: ["row_1"],
      rejectedRowIds: []
    })
  });
  assert.equal(confirm.status, 200);

  const suggested = await app.request("/eof/v1/reconciliations?workspaceId=workspace_1&status=suggested&limit=100", {
    headers: authHeaders()
  });
  assert.equal(suggested.status, 200);
  const suggestedPage = (await suggested.json()) as {
    readonly items: readonly {
      readonly bankDescription: string;
    }[];
  };
  const ambiguousSuggestedRow = suggestedPage.items.find((item) => item.bankDescription.includes("Awaiting category"));
  assert.equal(ambiguousSuggestedRow, undefined);

  const raw = await app.request("/eof/v1/bank/raw?workspaceId=workspace_1&period=2026-02&limit=100", {
    headers: authHeaders()
  });
  assert.equal(raw.status, 200);
  const rawPage = (await raw.json()) as {
    readonly items: readonly {
      readonly reference: string;
      readonly reconciliationStatus: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
      readonly matchedTransactionId: string | null;
    }[];
  };
  const rawRow = rawPage.items.find((item) => item.reference === "SUG-AMB-1");
  assert.ok(rawRow !== undefined);
  assert.equal(rawRow?.reconciliationStatus, "unmatched");
  assert.equal(rawRow?.matchedTransactionId, null);
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

test("distribution import reverse exposes voided status in list and screen filters", async () => {
  const app = createWriteEnabledFixtureApiService();
  const preview = await app.request("/erh/v1/imports/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "routenote",
      fileName: "routenote-voided.csv",
      checksum: "checksum-distribution-reverse-voided",
      rows: [{ title: "Raw song", artist: "Raw artist", currency: "USD", amount: "9.99" }]
    })
  });
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { readonly previewId: string };

  const confirm = await app.request("/erh/v1/imports/confirm", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-confirm-voided-1" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      previewId: previewJson.previewId,
      acceptedRowIds: ["row_1"],
      rejectedRowIds: []
    })
  });
  assert.equal(confirm.status, 200);
  const confirmJson = (await confirm.json()) as { readonly id: string };

  const reverse = await app.request(`/erh/v1/imports/batches/${confirmJson.id}/reverse`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "distribution-reverse-voided-1" },
    body: JSON.stringify({ workspaceId: "workspace_1" })
  });
  assert.equal(reverse.status, 200);

  const voidedList = await app.request("/erh/v1/imports/batches?workspaceId=workspace_1&status=voided&limit=100", {
    headers: authHeaders()
  });
  assert.equal(voidedList.status, 200);
  const voidedListPage = (await voidedList.json()) as { readonly items: readonly { readonly id: string; readonly status: string }[] };
  assert.ok(voidedListPage.items.some((item) => item.id === confirmJson.id && item.status === "voided"));

  const screen = await app.request("/erh/v1/screen?workspaceId=workspace_1&period=2026-06&importStatus=voided", {
    headers: authHeaders()
  });
  assert.equal(screen.status, 200);
  const screenJson = (await screen.json()) as {
    readonly importBatches: { readonly items: readonly { readonly id: string; readonly status: string }[] };
  };

  assert.ok(screenJson.importBatches.items.some((item) => item.id === confirmJson.id && item.status === "voided"));
  assert.equal(screenJson.importBatches.items.every((item) => item.status === "voided"), true);
});

test("distribution import preview keeps currencies from file rows and never emits RS fallback", async () => {
  const app = createWriteEnabledFixtureApiService();

  const explicitCurrenciesPreview = await app.request("/erh/v1/imports/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "routenote",
      fileName: "routenote-mixed.csv",
      checksum: "checksum-distribution-currency-mixed",
      rows: [
        { title: "Song A", currency: "eur", amount: "11.00" },
        { title: "Song B", Currency: "USD", amount: "9.50" },
        { title: "Song C", currency: "Rs", amount: "1.00" }
      ]
    })
  });
  assert.equal(explicitCurrenciesPreview.status, 200);
  const explicitCurrenciesJson = (await explicitCurrenciesPreview.json()) as { readonly currencyCodes: readonly string[] };
  assert.deepEqual(explicitCurrenciesJson.currencyCodes, ["EUR", "USD"]);

  const noCurrencyColumnPreview = await app.request("/erh/v1/imports/preview", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace_1",
      source: "kontor",
      fileName: "kontor-no-currency.csv",
      checksum: "checksum-distribution-currency-none",
      rows: [{ title: "Song D", amount: "7.00" }]
    })
  });
  assert.equal(noCurrencyColumnPreview.status, 200);
  const noCurrencyColumnJson = (await noCurrencyColumnPreview.json()) as { readonly currencyCodes: readonly string[] };
  assert.deepEqual(noCurrencyColumnJson.currencyCodes, []);
});

test("office bank import confirm writes idempotency, audit, batch, and lines in PGlite", async () => {
  const pglite = new PGlite();
  await createPgliteWriteTables(pglite);
  const testNowIso = new Date(Date.now() + 60_000).toISOString();
  const app = createApiService({
    fixtures: createFixtureStore(),
    persistence: createDrizzlePersistenceRuntime(drizzle(pglite) as Parameters<typeof createDrizzlePersistenceRuntime>[0], { WRITES_ENABLED: "true" }),
    health: null,
    nowIso: (): string => testNowIso,
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
        rows: [{ date: "2026-02-21", description: "PGlite line", debit: "23.45", currency: "MUR", accountId: "bank_mur", reference: "PGL-1" }]
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
    const originalReceipt = (await confirm.json()) as { readonly id: string };

    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 1);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 1);
    assert.equal(await pgliteCount(pglite, "office_bank_import_batches"), 1);
    assert.equal(await pgliteCount(pglite, "office_bank_statement_lines"), 1);

    const duplicateConfirm = await app.request("/eof/v1/bank-import/confirm", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": "bank-confirm-pglite-2" },
      body: JSON.stringify({
        workspaceId: "workspace_1",
        previewId: previewJson.previewId,
        acceptedRowIds: ["row_1"],
        rejectedRowIds: []
      })
    });
    assert.equal(duplicateConfirm.status, 200);
    const duplicateReceipt = (await duplicateConfirm.json()) as { readonly id: string; readonly importedTransactionCount: number };
    assert.equal(duplicateReceipt.id, originalReceipt.id);
    assert.equal(duplicateReceipt.importedTransactionCount, 1);
    assert.equal(await pgliteCount(pglite, "api_idempotency_keys"), 2);
    assert.equal(await pgliteCount(pglite, "audit_logs"), 2);
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

      if (token === "fixture-office-token") {
        return {
          userId: "user_office",
          email: "office@eeee.mu",
          role: "office",
          workspaceId: "eeee-mu"
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
      updated_at timestamp with time zone default now() not null,
      unique (workspace_id, idempotency_fingerprint)
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

    create table command_center_settings (
      workspace_id text not null,
      key text not null,
      value_json jsonb not null,
      status text not null,
      updated_by_user_id text not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      primary key (workspace_id, key)
    );

    create table command_center_integration_states (
      workspace_id text not null,
      integration_id text not null,
      enabled boolean not null,
      status text not null,
      updated_by_user_id text not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      primary key (workspace_id, integration_id)
    );

    create table command_center_user_permissions (
      workspace_id text not null,
      user_id text not null,
      email text not null,
      role text not null,
      permissions_json jsonb not null,
      updated_by_user_id text not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      primary key (workspace_id, user_id)
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
