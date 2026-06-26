import {
  createErrorState,
  createIdleState,
  createSuccessState,
  type AllocationRunSummary,
  type ApiRequestState,
  type CashflowBucket,
  type CurrencyCode,
  type DistributionContract,
  type DistributionDashboardResponse,
  type DistributionImportBatch,
  type DistributionMappingRow,
  type DistributionRevenueRow,
  type EhqApiClient,
  type OfficeDashboardResponse,
  type OfficePlanComptableNode,
  type OfficeRecentImport,
  type OfficeReconciliationCandidate,
  type OfficeTransaction,
  type PaymentSummary,
  type ReleaseSummary,
  type StatementSummary,
  type SuspenseItem,
  type TrackSummary
} from "@ehq/api-client";
import {
  actionCell,
  badgeCell,
  bar,
  check,
  checkCell,
  filter,
  kpi,
  metric,
  moneyCell,
  page,
  panel,
  platformPages,
  table,
  textCell,
  type BarPoint,
  type DetailPanel,
  type DivergenceRow,
  type PlatformPage,
  type PlatformPageId,
  type TableCell,
  type Tone,
  type TreeRow
} from "./platform-data.js";

export type PlatformPageStates = Readonly<Record<PlatformPageId, ApiRequestState<PlatformPage>>>;

interface MoneyPoint {
  readonly label: string;
  readonly amount: string;
}

export function createInitialPlatformPageStates(): PlatformPageStates {
  const entries = Object.keys(platformPages).map((pageId: string): readonly [PlatformPageId, ApiRequestState<PlatformPage>] => [
    pageId as PlatformPageId,
    createIdleState<PlatformPage>()
  ]);
  return Object.fromEntries(entries) as PlatformPageStates;
}

export async function loadPlatformPage(
  client: EhqApiClient,
  pageId: PlatformPageId,
  workspaceRef: string,
  period: string
): Promise<ApiRequestState<PlatformPage>> {
  try {
    return createSuccessState<PlatformPage>(await loadPlatformPageData(client, pageId, workspaceRef, period));
  } catch (error: unknown) {
    return createErrorState<PlatformPage>(error);
  }
}

async function loadPlatformPageData(
  client: EhqApiClient,
  pageId: PlatformPageId,
  workspaceRef: string,
  period: string
): Promise<PlatformPage> {
  if (pageId === "of_dash") {
    return loadOfficeDashboardPage(client, workspaceRef, period);
  }

  if (pageId === "of_pnl") {
    return loadOfficePnlPage(client, workspaceRef, period);
  }

  if (pageId === "of_coa") {
    return loadOfficeChartOfAccountsPage(client, workspaceRef);
  }

  if (pageId === "of_tx") {
    return loadOfficeTransactionsPage(client, workspaceRef, period);
  }

  if (pageId === "of_imports") {
    return loadOfficeImportsPage(client, workspaceRef, period);
  }

  if (pageId === "of_recon") {
    return loadOfficeReconciliationPage(client, workspaceRef, period);
  }

  if (pageId === "of_pending") {
    return loadOfficePendingPage(client, workspaceRef, period);
  }

  if (pageId === "of_cash") {
    return loadOfficeCashflowPage(client, workspaceRef, period);
  }

  if (pageId === "di_dash") {
    return loadDistributionDashboardPage(client, workspaceRef, period);
  }

  if (pageId === "di_imports") {
    return loadDistributionImportsPage(client, workspaceRef);
  }

  if (pageId === "di_mapping") {
    return loadDistributionMappingPage(client, workspaceRef);
  }

  if (pageId === "di_catalog") {
    return loadDistributionCatalogPage(client, workspaceRef);
  }

  if (pageId === "di_contracts") {
    return loadDistributionContractsPage(client, workspaceRef);
  }

  if (pageId === "di_alloc") {
    return loadDistributionAllocationsPage(client, workspaceRef, period);
  }

  if (pageId === "di_suspense") {
    return loadDistributionSuspensePage(client, workspaceRef, period);
  }

  if (pageId === "di_state") {
    return loadDistributionStatementsPage(client, workspaceRef, period);
  }

  if (pageId === "di_pay") {
    return loadDistributionPaymentsPage(client, workspaceRef, period);
  }

  if (pageId === "di_rev") {
    return loadDistributionRevenuePage(client, workspaceRef, period);
  }

  return page({
    ...platformPages[pageId],
    note: commandCenterNote(pageId)
  });
}

async function loadOfficeDashboardPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const [dashboard, reconciliationResponse, bankQuality, cashflow, projectsResponse] = await Promise.all([
    client.office.getDashboard({ workspaceId: workspaceRef, period }),
    client.office.listReconciliations({
      workspaceId: workspaceRef,
      accountId: null,
      period,
      status: null,
      cursor: null,
      limit: 25
    }),
    client.office.getBankQuality({ workspaceId: workspaceRef, period }),
    client.office.getCashflow({
      workspaceId: workspaceRef,
      from: `${period}-01`,
      to: periodEndDate(period),
      accountId: null
    }),
    client.office.listProjects({
      workspaceId: workspaceRef,
      status: "active",
      cursor: null,
      limit: 25
    })
  ]);

  const reconciliationRows = reconciliationResponse.items;
  const activeProjects = projectsResponse.items
    .filter((project): boolean => project.status === "active")
    .sort((left, right): number => {
      const leftNet = apiMoneyToMicroUnits(left.netMicro);
      const rightNet = apiMoneyToMicroUnits(right.netMicro);
      if (leftNet === rightNet) {
        return 0;
      }
      return leftNet > rightNet ? -1 : 1;
    })
    .slice(0, 12);

  const periodStart = `${period}-01`;
  const periodEnd = periodEndDate(period);

  return page({
    ...platformPages.of_dash,
    subtitle: `Period ${dashboard.period} · finance, bank and monitoring summary.`,
    kpis: [
      kpi("Cash balance", formatMoney(dashboard.cashBalanceMicro, "MUR"), "cash register", moneyTone(dashboard.cashBalanceMicro), false),
      kpi("Receivables", formatMoney(dashboard.receivablesMicro, "MUR"), "open", moneyTone(dashboard.receivablesMicro), false),
      kpi("Payables", formatMoney(dashboard.payablesMicro, "MUR"), "open", moneyTone(dashboard.payablesMicro), false),
      kpi(
        "Unreconciled",
        formatCount(dashboard.unreconciledTransactionCount),
        `${formatCount(bankQuality.unmatchedLineCount)} unmatched`,
        dashboard.unreconciledTransactionCount > 0 ? "warning" : "success",
        true
      )
    ],
    chartTitle: "Cash flow",
    chartSubtitle: `Range ${periodStart} → ${periodEnd}`,
    bars: barsFromMoneyPoints(cashflow.map((bucket): MoneyPoint => ({
      label: bucket.period,
      amount: bucket.closingMicro
    }))),
    checksTitle: "Monitoring",
    checksSubtitle: "read-only live",
    checks: [
      check("Dashboard endpoint loaded", "success"),
      check(`${formatCount(reconciliationRows.length)} reconciliation row(s)`, reconciliationRows.length > 0 ? "success" : "warning"),
      check(
        `${formatBasisPoints(bankQuality.matchedRateBp)} matched`,
        bankQuality.matchedRateBp > 9_000 ? "success" : "warning"
      )
    ],
    panels: [
      panel(
        "Monitoring",
        `${periodStart} → ${periodEnd}`,
        [
          metric(
            "Bank quality",
            formatBasisPoints(bankQuality.matchedRateBp),
            bankQuality.matchedRateBp > 9_000 ? "success" : bankQuality.matchedRateBp > 0 ? "warning" : "error"
          ),
          metric("Unmatched lines", formatCount(bankQuality.unmatchedLineCount), bankQuality.unmatchedLineCount > 0 ? "warning" : "success"),
          metric("Stale import", formatCount(bankQuality.staleImportCount), bankQuality.staleImportCount > 0 ? "warning" : "success")
        ],
        [],
        ["Open monitoring"]
      ),
      panel(
        "Cash flow range",
        `${periodStart} → ${periodEnd}`,
        [
          metric("Inflows", formatMoney(sumMoney(cashflow.map((bucket): string => bucket.inflowMicro)), "MUR"), "success"),
          metric("Outflows", formatMoney(sumMoney(cashflow.map((bucket): string => bucket.outflowMicro)), "MUR"), "error"),
          metric("Closing", cashflow.length === 0 ? "Rs 0" : formatMoney(cashflow[cashflow.length - 1]?.closingMicro ?? "0", "MUR"), "active")
        ],
        [],
        ["Open cash flow"]
      )
    ],
    treeRows:
      activeProjects.length > 0
        ? activeProjects.map((project): TreeRow => ({
          depth: 1,
          label: project.label,
          meta: `${project.code} · ${formatMoney(project.netMicro, "MUR")}`,
          badge: project.openViolationCount > 0 ? `${project.openViolationCount} issues` : "",
          tone: moneyTone(project.netMicro),
          action: "Open"
        }))
        : [
          {
            depth: 1,
            label: "No active project this period.",
            meta: "Try another period",
            badge: "",
            tone: "muted",
            action: ""
          }
        ],
    table: table(
      "Recent reconciliation",
      "Open",
      [
        { label: "Date", align: "left" },
        { label: "Bank", align: "left" },
        { label: "Ledger", align: "left" },
        { label: "Status", align: "left" },
        { label: "Amount", align: "right" }
      ],
      reconciliationRows.length > 0
        ? reconciliationRows.map((candidate): readonly TableCell[] => [
          textCell(shortDate(candidate.occurredOn), true),
          textCell(candidate.bankDescription, false),
          textCell(candidate.ledgerDescription, false),
          badgeCell(candidate.status, candidate.status === "matched" ? "success" : candidate.status === "suggested" ? "warning" : "error"),
          moneyCell(formatMoney(candidate.amountMicro, "MUR"), moneyTone(candidate.amountMicro))
        ])
        : [
          [
            textCell("No reconciliation row returned.", true),
            textCell("-", false),
            textCell("-", false),
            badgeCell("No rows", "muted"),
            moneyCell("0", "muted")
          ]
        ]
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficePnlPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const pnl = await client.office.getGlobalPnl({ workspaceId: workspaceRef, period });
  const projectionRows = topItems(pnl.projectionRows, 8);
  const lineRows = topItems(pnl.lines, 12);

  return page({
    ...platformPages.of_pnl,
    subtitle: `Validated projection · ${pnl.period}`,
    kpis: [
      kpi("Revenue", formatMoney(pnl.incomeMicro, "MUR"), `${String(pnl.lines.length)} P&L lines`, "success", false),
      kpi("Expenses", formatMoney(pnl.expenseMicro, "MUR"), "validated categories", "error", false),
      kpi("Net result", formatSignedMoney(pnl.netMicro, "MUR"), pnl.completeness, moneyTone(pnl.netMicro), true),
      kpi("Projection", pnl.validatedProjectionId, pnl.period, "info", false)
    ],
    chartTitle: "Result by department",
    chartSubtitle: "loaded from /eof/v1/pl/global",
    bars: [],
    divergenceRows: projectionRows.map((row): DivergenceRow => ({
      label: row.departmentLabel,
      revenue: formatMoney(row.revenueMicro, "MUR"),
      expenses: formatMoney(row.expenseMicro, "MUR"),
      net: formatSignedMoney(row.netMicro, "MUR"),
      tone: row.netTone === "positive" ? "success" : "error",
      level: clampLevel(row.netBarLevel)
    })),
    checksTitle: "Projection",
    checksSubtitle: "server-read",
    checks: [
      check("Global P&L endpoint loaded", "success"),
      check(`${String(pnl.projectionRows.length)} department row(s)`, "info"),
      check("No browser-side recalculation", "success")
    ],
    table: table(
      `P&L lines · ${pnl.period}`,
      "Export",
      [
        { label: "Line", align: "left" },
        { label: "Income", align: "right" },
        { label: "Expense", align: "right" },
        { label: "Net", align: "right" },
        { label: "Status", align: "left" }
      ],
      lineRows.map((row): readonly TableCell[] => [
        textCell(row.label, true),
        moneyCell(formatMoney(row.incomeMicro, "MUR"), "success"),
        moneyCell(formatMoney(row.expenseMicro, "MUR"), "error"),
        moneyCell(formatSignedMoney(row.netMicro, "MUR"), moneyTone(row.netMicro)),
        badgeCell("Validated", "success")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficeChartOfAccountsPage(client: EhqApiClient, workspaceRef: string): Promise<PlatformPage> {
  const nodes = await client.office.getPlanComptable({ workspaceId: workspaceRef, includeInactive: true });
  const categories = nodes.filter((node): node is Extract<OfficePlanComptableNode, { readonly kind: "category" }> => node.kind === "category");
  const departments = nodes.filter((node): boolean => node.kind === "department");
  const inactiveCount = nodes.filter((node): boolean => !node.active).length;

  return page({
    ...platformPages.of_coa,
    subtitle: "Managed tree · loaded from /eof/v1/plan-comptable.",
    kpis: [
      kpi("Categories", formatCount(categories.length), `${formatCount(departments.length)} departments`, "muted", true),
      kpi("Income", formatCount(categories.filter((node): boolean => node.type === "income").length), "category nodes", "success", false),
      kpi("Expenses", formatCount(categories.filter((node): boolean => node.type === "expense").length), "category nodes", "error", false),
      kpi("Inactive", formatCount(inactiveCount), "kept visible", inactiveCount > 0 ? "warning" : "success", false)
    ],
    chartTitle: "Category mix",
    chartSubtitle: "server chart of accounts",
    bars: [
      bar("Dept.", departments.length * 10),
      bar("Div.", nodes.filter((node): boolean => node.kind === "division").length * 5),
      bar("Cat.", clampLevel(categories.length)),
      bar("Inactive", inactiveCount * 10)
    ],
    checksTitle: "Quality",
    checksSubtitle: "read model",
    checks: [
      check("Stable node IDs", "success"),
      check("Department -> division -> category", "success"),
      check(inactiveCount > 0 ? `${String(inactiveCount)} inactive node(s)` : "All loaded nodes active", inactiveCount > 0 ? "warning" : "success")
    ],
    treeRows: topItems(nodes, 24).map(toTreeRow),
    table: table(
      "Categories",
      "Add",
      [
        { label: "Category", align: "left" },
        { label: "Division", align: "left" },
        { label: "Department", align: "left" },
        { label: "Type", align: "left" },
        { label: "Status", align: "left" }
      ],
      topItems(categories, 12).map((node): readonly TableCell[] => [
        textCell(node.label, true),
        textCell(node.divisionLabel, false),
        textCell(node.departmentLabel, false),
        badgeCell(node.type, node.type === "income" ? "success" : "error"),
        badgeCell(node.active ? "Active" : "Inactive", node.active ? "success" : "warning")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficeTransactionsPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.office.listTransactions(createOfficeTransactionsQuery(workspaceRef, period, null));
  const transactions = response.items;
  const signedAmounts = transactions.map(transactionSignedAmount);
  const postedCount = transactions.filter((transaction): boolean => transaction.status === "posted" || transaction.status === "reconciled").length;
  const draftCount = transactions.filter((transaction): boolean => transaction.status === "draft" || transaction.status === "pending").length;

  return page({
    ...platformPages.of_tx,
    subtitle: `Ledger · ${period}.`,
    kpis: [
      kpi("Lines", formatCount(transactions.length), response.nextCursor === null ? "current page" : "more available", "success", true),
      kpi("Posted", formatCount(postedCount), "posted or reconciled", "success", false),
      kpi("Drafts", formatCount(draftCount), "pending classification", draftCount > 0 ? "warning" : "success", false),
      kpi("Net page", formatSignedMoney(sumMoney(signedAmounts), "MUR"), "display total", moneyTone(sumMoney(signedAmounts)), false)
    ],
    chartTitle: "Recent flows",
    chartSubtitle: "loaded transactions",
    bars: barsFromMoneyPoints(transactions.map((transaction): MoneyPoint => ({
      label: transaction.occurredOn.slice(8, 10),
      amount: transactionSignedAmount(transaction)
    }))),
    checksTitle: "Validation",
    checksSubtitle: "ledger state",
    checks: [
      check("Category required before posting", "success"),
      check(`${formatCount(draftCount)} draft/pending line(s)`, draftCount > 0 ? "warning" : "success"),
      check("Read-only page load", "success")
    ],
    table: table(
      `${period} transactions`,
      "New entry",
      [
        { label: "Date", align: "left" },
        { label: "Label", align: "left" },
        { label: "Department", align: "left" },
        { label: "Category", align: "left" },
        { label: "Amount", align: "right" },
        { label: "Status", align: "left" }
      ],
      transactions.map((transaction): readonly TableCell[] => [
        textCell(shortDate(transaction.occurredOn), false),
        textCell(transaction.description, true),
        textCell(transaction.departmentLabel ?? "-", false),
        textCell(transaction.categoryLabel ?? "-", false),
        moneyCell(formatSignedMoney(transactionSignedAmount(transaction), transaction.currency), transactionTone(transaction)),
        badgeCell(transaction.status, transaction.status === "pending" || transaction.status === "draft" ? "warning" : "success")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficeImportsPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const dashboard = await client.office.getDashboard({ workspaceId: workspaceRef, period });
  const imports = dashboard.recentImports ?? [];
  const acceptedRows = imports.reduce((sum: number, item: OfficeRecentImport): number => sum + item.acceptedRowCount, 0);
  const rejectedRows = imports.reduce((sum: number, item: OfficeRecentImport): number => sum + item.rejectedRowCount, 0);
  const failedRows = imports.filter((item): boolean => item.status === "failed").length;

  return page({
    ...platformPages.of_imports,
    subtitle: "Bank statement batches from the Office dashboard endpoint.",
    kpis: [
      kpi("Batches", formatCount(imports.length), period, "info", true),
      kpi("Accepted rows", formatCount(acceptedRows), "bank + cashflow", "success", false),
      kpi("Rejected rows", formatCount(rejectedRows), "to review", rejectedRows > 0 ? "warning" : "success", false),
      kpi("Failed", formatCount(failedRows), "recent batches", failedRows > 0 ? "error" : "success", false)
    ],
    chartTitle: "Import health",
    chartSubtitle: "recent batches",
    bars: barsFromCounts(imports.map((item): readonly [string, number] => [item.source.toUpperCase(), item.acceptedRowCount])),
    checksTitle: "Import",
    checksSubtitle: "reversible batch",
    checks: [
      check("Recent imports endpoint loaded", "success"),
      check(`${formatCount(acceptedRows)} accepted row(s)`, "success"),
      check(failedRows > 0 ? `${formatCount(failedRows)} failed batch(es)` : "No failed recent batch", failedRows > 0 ? "error" : "success")
    ],
    table: table(
      "Recent imports",
      "Import",
      [
        { label: "File", align: "left" },
        { label: "Source", align: "left" },
        { label: "Accepted", align: "right" },
        { label: "Period", align: "left" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      imports.map(toOfficeImportRow)
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficeReconciliationPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const [response, quality] = await Promise.all([
    client.office.listReconciliations({
      workspaceId: workspaceRef,
      accountId: null,
      period,
      status: null,
      cursor: null,
      limit: 25
    }),
    client.office.getBankQuality({ workspaceId: workspaceRef, period })
  ]);
  const candidates = response.items;
  const suggestedCount = candidates.filter((candidate): boolean => candidate.status === "suggested").length;
  const matchedCount = candidates.filter((candidate): boolean => candidate.status === "matched").length;

  return page({
    ...platformPages.of_recon,
    subtitle: `Bank matching quality · ${period}.`,
    kpis: [
      kpi("Unmatched lines", formatCount(quality.unmatchedLineCount), "bank-quality", quality.unmatchedLineCount > 0 ? "warning" : "success", true),
      kpi("Matched rate", formatBasisPoints(quality.matchedRateBp), "basis points", "success", false),
      kpi("Suggestions", formatCount(suggestedCount), "candidate page", suggestedCount > 0 ? "warning" : "muted", false),
      kpi("Matched", formatCount(matchedCount), "candidate page", "success", false)
    ],
    chartTitle: "Matching confidence",
    chartSubtitle: "reconciliation proposals",
    bars: candidates.map((candidate): BarPoint => bar(formatBasisPoints(candidate.confidenceBp), basisPointsToLevel(candidate.confidenceBp))),
    checksTitle: "Gate",
    checksSubtitle: "before validation",
    checks: [
      check("No partial posting from HQ shell", "success"),
      check(`${formatCount(quality.duplicateCandidateCount)} duplicate candidate(s)`, quality.duplicateCandidateCount > 0 ? "warning" : "success"),
      check(`${formatCount(quality.missingReferenceCount)} missing reference(s)`, quality.missingReferenceCount > 0 ? "warning" : "success")
    ],
    table: table(
      "Proposed matches",
      "Approve high-confidence",
      [
        { label: "Bank line", align: "left" },
        { label: "Date", align: "left" },
        { label: "Amount", align: "right" },
        { label: "Proposed match", align: "left" },
        { label: "Conf.", align: "left" },
        { label: "", align: "left" }
      ],
      candidates.map((candidate): readonly TableCell[] => [
        textCell(candidate.bankDescription, true),
        textCell(shortDate(candidate.occurredOn), false),
        moneyCell(formatMoney(candidate.amountMicro, "MUR"), moneyTone(candidate.amountMicro)),
        textCell(candidate.ledgerDescription, false),
        badgeCell(formatBasisPoints(candidate.confidenceBp), candidate.confidenceBp >= 9000 ? "success" : "warning"),
        actionCell(candidate.status === "matched" ? "View" : "Review", candidate.status === "suggested" ? "active" : "muted")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficePendingPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const [pendingResponse, draftResponse] = await Promise.all([
    client.office.listTransactions(createOfficeTransactionsQuery(workspaceRef, period, "pending")),
    client.office.listTransactions(createOfficeTransactionsQuery(workspaceRef, period, "draft"))
  ]);
  const transactions = [...pendingResponse.items, ...draftResponse.items];
  const missingCategoryCount = transactions.filter((transaction): boolean => transaction.categoryId === null).length;

  return page({
    ...platformPages.of_pending,
    subtitle: "Draft and pending transactions from the Office API.",
    kpis: [
      kpi("Draft queue", formatCount(transactions.length), "items", transactions.length > 0 ? "warning" : "success", true),
      kpi("Missing category", formatCount(missingCategoryCount), "manual", missingCategoryCount > 0 ? "warning" : "success", false),
      kpi("Pending", formatCount(pendingResponse.items.length), "awaiting category", pendingResponse.items.length > 0 ? "warning" : "success", false),
      kpi("Draft", formatCount(draftResponse.items.length), "editable", draftResponse.items.length > 0 ? "info" : "muted", false)
    ],
    chartTitle: "Drafts",
    chartSubtitle: "loaded queue",
    bars: barsFromMoneyPoints(transactions.map((transaction): MoneyPoint => ({
      label: transaction.categoryLabel ?? "Unmapped",
      amount: transaction.amountMicro
    }))),
    checksTitle: "Bulk validate",
    checksSubtitle: "clean lines only",
    checks: [
      check(`${formatCount(transactions.length)} draft/pending line(s)`, transactions.length > 0 ? "warning" : "success"),
      check(`${formatCount(missingCategoryCount)} without category`, missingCategoryCount > 0 ? "warning" : "success"),
      check("Validation batch stays server-side", "success")
    ],
    table: table(
      `Draft queue · ${formatCount(transactions.length)} item(s)`,
      "Bulk validate",
      [
        { label: "", align: "left" },
        { label: "Label", align: "left" },
        { label: "Department", align: "left" },
        { label: "Category", align: "left" },
        { label: "Amount", align: "right" },
        { label: "", align: "left" }
      ],
      transactions.map((transaction): readonly TableCell[] => [
        checkCell(false),
        textCell(transaction.description, true),
        textCell(transaction.departmentLabel ?? "-", false),
        textCell(transaction.categoryLabel ?? "-", false),
        moneyCell(formatMoney(transaction.amountMicro, transaction.currency), transactionTone(transaction)),
        actionCell(transaction.categoryId === null ? "Classify" : "Validate", transaction.categoryId === null ? "muted" : "active")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadOfficeCashflowPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const buckets = await client.office.getCashflow({
    workspaceId: workspaceRef,
    from: `${period}-01`,
    to: periodEndDate(period),
    accountId: null
  });
  const inflowTotal = sumMoney(buckets.map((bucket): string => bucket.inflowMicro));
  const outflowTotal = sumMoney(buckets.map((bucket): string => bucket.outflowMicro));
  const closing = buckets[buckets.length - 1]?.closingMicro ?? "0";
  const opening = buckets[0] === undefined ? "0" : addMoney(addMoney(buckets[0].closingMicro, buckets[0].outflowMicro), negateMoney(buckets[0].inflowMicro));

  return page({
    ...platformPages.of_cash,
    subtitle: `Inflows, outflows and projection · ${period}.`,
    kpis: [
      kpi("Opening", formatMoney(opening, "MUR"), `${period}-01`, "muted", false),
      kpi("Inflows", formatMoney(inflowTotal, "MUR"), period, "success", false),
      kpi("Outflows", formatMoney(outflowTotal, "MUR"), period, "error", false),
      kpi("Closing", formatMoney(closing, "MUR"), `${formatCount(buckets.length)} bucket(s)`, moneyTone(closing), true)
    ],
    chartTitle: "Cash movement",
    chartSubtitle: "projection buckets",
    bars: buckets.flatMap((bucket): readonly BarPoint[] => [
      bar(`${bucket.period} in`, clampLevel(bucket.inflowLevel)),
      bar(`${bucket.period} out`, clampLevel(bucket.outflowLevel))
    ]),
    checksTitle: "Projection",
    checksSubtitle: "short term",
    checks: [
      check("Cashflow endpoint loaded", "success"),
      check(`${formatCount(buckets.length)} projection bucket(s)`, "info"),
      check("Account filter is all accounts", "success")
    ],
    table: table(
      "Projection buckets",
      "Project",
      [
        { label: "Period", align: "left" },
        { label: "Inflows", align: "right" },
        { label: "Outflows", align: "right" },
        { label: "Closing", align: "right" },
        { label: "Status", align: "left" }
      ],
      buckets.map((bucket: CashflowBucket): readonly TableCell[] => [
        textCell(bucket.period, true),
        moneyCell(formatMoney(bucket.inflowMicro, "MUR"), "success"),
        moneyCell(formatMoney(bucket.outflowMicro, "MUR"), "error"),
        moneyCell(formatMoney(bucket.closingMicro, "MUR"), moneyTone(bucket.closingMicro)),
        badgeCell("Projected", "info")
      ])
    ),
    note: "Live read from the typed Office API."
  });
}

async function loadDistributionDashboardPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const dashboard = await client.distribution.getDashboard({ workspaceId: workspaceRef, period });

  return page({
    ...platformPages.di_dash,
    subtitle: `Royalty cockpit · ${dashboard.period}.`,
    kpis: distributionDashboardKpis(dashboard),
    chartTitle: "Royalty totals",
    chartSubtitle: "dashboard response",
    bars: barsFromMoneyPoints([
      { label: "Gross", amount: dashboard.grossRoyaltyMicro },
      { label: "Recoup", amount: dashboard.recoupedMicro },
      { label: "Net", amount: dashboard.netPayableMicro }
    ]),
    checksTitle: "Health",
    checksSubtitle: "royalty operations",
    checks: [
      check("Dashboard endpoint loaded", "success"),
      check(`${formatCount(dashboard.suspenseCount)} suspense item(s)`, dashboard.suspenseCount > 0 ? "warning" : "success"),
      check(`${formatCount(dashboard.openStatementCount)} open statement(s)`, dashboard.openStatementCount > 0 ? "warning" : "success")
    ],
    table: table(
      "Actions",
      "View all",
      [
        { label: "Action", align: "left" },
        { label: "Context", align: "left" },
        { label: "Count", align: "right" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      [
        [textCell("Resolve suspense", true), textCell(dashboard.period, false), moneyCell(formatCount(dashboard.suspenseCount), dashboard.suspenseCount > 0 ? "warning" : "success"), badgeCell(dashboard.suspenseCount > 0 ? "Review" : "Clear", dashboard.suspenseCount > 0 ? "warning" : "success"), actionCell("Open", "muted")],
        [textCell("Post statements", true), textCell(dashboard.period, false), moneyCell(formatCount(dashboard.openStatementCount), dashboard.openStatementCount > 0 ? "warning" : "success"), badgeCell(dashboard.openStatementCount > 0 ? "Open" : "Clear", dashboard.openStatementCount > 0 ? "warning" : "success"), actionCell("Open", "muted")]
      ]
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionImportsPage(client: EhqApiClient, workspaceRef: string): Promise<PlatformPage> {
  const response = await client.distribution.listImportBatches({
    workspaceId: workspaceRef,
    source: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const batches = response.items;
  const rowCount = batches.reduce((sum: number, batch: DistributionImportBatch): number => sum + batch.rowCount, 0);
  const unmatchedCount = batches.reduce((sum: number, batch: DistributionImportBatch): number => sum + batch.unmatchedRowCount, 0);

  return page({
    ...platformPages.di_imports,
    subtitle: "Upload health and batch diagnostics from /erh/v1/imports/batches.",
    kpis: [
      kpi("Batches", formatCount(batches.length), "current page", "info", true),
      kpi("Rows", formatCount(rowCount), "normalized", "success", false),
      kpi("Unmatched", formatCount(unmatchedCount), "mapping", unmatchedCount > 0 ? "warning" : "success", false),
      kpi("Gross", formatMoney(sumMoney(batches.map((batch): string => batch.grossMicro)), batches[0]?.currency ?? "USD"), "loaded rows", "success", false)
    ],
    chartTitle: "Imported batches",
    chartSubtitle: "by source",
    bars: barsFromCounts(groupCounts(batches.map((batch): string => batch.source))),
    checksTitle: "Diagnostics",
    checksSubtitle: "by batch",
    checks: [
      check("Import batch endpoint loaded", "success"),
      check(`${formatCount(unmatchedCount)} unmatched row(s)`, unmatchedCount > 0 ? "warning" : "success"),
      check(response.nextCursor === null ? "First page complete" : "More batches available", response.nextCursor === null ? "success" : "info")
    ],
    table: table(
      "Batches",
      "Import",
      [
        { label: "Batch", align: "left" },
        { label: "Store", align: "left" },
        { label: "Rows", align: "right" },
        { label: "Currency", align: "left" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      batches.map((batch): readonly TableCell[] => [
        textCell(batch.fileName, true),
        textCell(batch.source, false),
        moneyCell(formatCount(batch.rowCount), "muted"),
        textCell(batch.currency, false),
        badgeCell(batch.status, importStatusTone(batch.status)),
        actionCell(batch.nextAction.replace(/_/gu, " "), batch.nextAction === "review_mapping" ? "active" : "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionMappingPage(client: EhqApiClient, workspaceRef: string): Promise<PlatformPage> {
  const response = await client.distribution.listMappingRows({
    workspaceId: workspaceRef,
    batchId: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const rows = response.items;
  const unmappedCount = rows.filter((row): boolean => row.status === "unmapped").length;
  const suggestedCount = rows.filter((row): boolean => row.status === "suggested").length;
  const mappedCount = rows.filter((row): boolean => row.status === "mapped").length;

  return page({
    ...platformPages.di_mapping,
    subtitle: "Imported line mapping from /erh/v1/mapping/rows.",
    kpis: [
      kpi("Rows", formatCount(rows.length), "current page", "info", true),
      kpi("Suggested", formatCount(suggestedCount), "auto-match", suggestedCount > 0 ? "success" : "muted", false),
      kpi("Unmapped", formatCount(unmappedCount), "manual", unmappedCount > 0 ? "warning" : "success", false),
      kpi("Mapped", formatCount(mappedCount), "accepted", "success", false)
    ],
    chartTitle: "Matching confidence",
    chartSubtitle: "imported lines",
    bars: rows.map((row): BarPoint => bar(row.sourceStore, basisPointsToLevel(row.confidenceBp))),
    checksTitle: "Automation",
    checksSubtitle: "safe only",
    checks: [
      check("Mapping rows endpoint loaded", "success"),
      check(`${formatCount(suggestedCount)} suggestion(s)`, suggestedCount > 0 ? "info" : "muted"),
      check(`${formatCount(unmappedCount)} manual mapping row(s)`, unmappedCount > 0 ? "warning" : "success")
    ],
    table: table(
      "Rows to review",
      "Apply rules",
      [
        { label: "Imported title", align: "left" },
        { label: "Artist", align: "left" },
        { label: "Matched track", align: "left" },
        { label: "Confidence", align: "left" },
        { label: "", align: "left" }
      ],
      rows.map((row: DistributionMappingRow): readonly TableCell[] => [
        textCell(row.sourceTitle, true),
        textCell(row.sourceArtist, false),
        textCell(row.suggestedTrackTitle ?? "-", false),
        badgeCell(formatBasisPoints(row.confidenceBp), row.confidenceBp >= 9000 ? "success" : "warning"),
        actionCell(row.status === "mapped" ? "View" : "Map", row.status === "suggested" ? "active" : "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionCatalogPage(client: EhqApiClient, workspaceRef: string): Promise<PlatformPage> {
  const [releaseResponse, trackResponse] = await Promise.all([
    client.distribution.listReleases({ workspaceId: workspaceRef, status: null, cursor: null, limit: 25 }),
    client.distribution.listTracks({ workspaceId: workspaceRef, releaseId: null, status: null, cursor: null, limit: 25 })
  ]);
  const releases = releaseResponse.items;
  const tracks = trackResponse.items;
  const needsReviewCount = tracks.filter((track): boolean => track.splitStatus === "needs_review").length;
  const missingIsrcCount = tracks.filter((track): boolean => track.isrc === null).length;

  return page({
    ...platformPages.di_catalog,
    subtitle: "Canonical catalog from release and track endpoints.",
    kpis: [
      kpi("Releases", formatCount(releases.length), "current page", "success", false),
      kpi("Tracks", formatCount(tracks.length), "current page", "success", true),
      kpi("Needs review", formatCount(needsReviewCount), "splits", needsReviewCount > 0 ? "warning" : "success", false),
      kpi("Missing ISRC", formatCount(missingIsrcCount), "catalog", missingIsrcCount > 0 ? "warning" : "success", false)
    ],
    chartTitle: "Catalog",
    chartSubtitle: "release status",
    bars: barsFromCounts(groupCounts(releases.map((release: ReleaseSummary): string => release.status))),
    checksTitle: "Quality",
    checksSubtitle: "before allocation",
    checks: [
      check("Releases endpoint loaded", "success"),
      check("Tracks endpoint loaded", "success"),
      check(`${formatCount(needsReviewCount)} split review item(s)`, needsReviewCount > 0 ? "warning" : "success")
    ],
    table: table(
      "Tracks",
      "Add",
      [
        { label: "Title", align: "left" },
        { label: "Artist", align: "left" },
        { label: "ISRC", align: "left" },
        { label: "Contributors", align: "right" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      tracks.map((track: TrackSummary): readonly TableCell[] => [
        textCell(track.title, true),
        textCell(track.artistName, false),
        textCell(track.isrc ?? "-", false),
        moneyCell(formatCount(track.contributorCount), "muted"),
        badgeCell(track.splitStatus, track.splitStatus === "balanced" ? "success" : "warning"),
        actionCell("Open", "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionContractsPage(client: EhqApiClient, workspaceRef: string): Promise<PlatformPage> {
  const response = await client.distribution.listContracts({
    workspaceId: workspaceRef,
    payeeId: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const contracts = response.items;
  const activeCount = contracts.filter((contract): boolean => contract.status === "active").length;
  const reviewCount = contracts.filter((contract): boolean => contract.splitBp !== 10_000).length;

  return page({
    ...platformPages.di_contracts,
    subtitle: "Splits, payees, expenses and recoupments from /erh/v1/contracts.",
    kpis: [
      kpi("Contracts", formatCount(contracts.length), "current page", "success", true),
      kpi("Active", formatCount(activeCount), "catalog", "success", false),
      kpi("Open recoupments", formatMoney(sumMoney(contracts.map((contract): string => contract.openExpenseMicro)), contracts[0]?.currency ?? "MUR"), "audited source", "warning", false),
      kpi("Split review", formatCount(reviewCount), "not 10 000 bp", reviewCount > 0 ? "warning" : "success", false)
    ],
    chartTitle: "Contract state",
    chartSubtitle: "splits and expenses",
    bars: barsFromCounts(groupCounts(contracts.map((contract): string => contract.status))),
    checksTitle: "Contract",
    checksSubtitle: "before allocation",
    checks: [
      check("Contracts endpoint loaded", "success"),
      check(`${formatCount(reviewCount)} split review item(s)`, reviewCount > 0 ? "warning" : "success"),
      check("Open recoupments are server-provided", "success")
    ],
    table: table(
      "Contracts",
      "Create",
      [
        { label: "Contract", align: "left" },
        { label: "Payee", align: "left" },
        { label: "Split", align: "left" },
        { label: "Expenses", align: "right" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      contracts.map((contract: DistributionContract): readonly TableCell[] => [
        textCell(contract.title, true),
        textCell(contract.payeeId, false),
        textCell(formatBasisPoints(contract.splitBp), false),
        moneyCell(formatMoney(contract.openExpenseMicro, contract.currency), moneyTone(contract.openExpenseMicro)),
        badgeCell(contract.status, contract.status === "active" ? "success" : "warning"),
        actionCell("Open split", contract.splitBp === 10_000 ? "muted" : "active")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionAllocationsPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.distribution.listAllocationRuns({
    workspaceId: workspaceRef,
    period: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const runs = response.items;
  const completedRuns = runs.filter((run): boolean => run.status === "completed").length;
  const activeRuns = runs.filter((run): boolean => run.status === "queued" || run.status === "running").length;
  const lastRun = runs[0] ?? null;

  return page({
    ...platformPages.di_alloc,
    subtitle: `Preview, post and unpost batches · ${period}.`,
    kpis: [
      kpi("Runs", formatCount(runs.length), "current page", "info", true),
      kpi("Completed", formatCount(completedRuns), "posted", "success", false),
      kpi("Active", formatCount(activeRuns), "queued/running", activeRuns > 0 ? "warning" : "success", false),
      kpi("Allocated", formatMoney(sumMoney(runs.map((run): string => run.totalAllocatedMicro)), "MUR"), "loaded runs", "active", false)
    ],
    chartTitle: "Run waves",
    chartSubtitle: "allocation totals",
    bars: barsFromMoneyPoints(runs.map((run): MoneyPoint => ({ label: run.period, amount: run.totalAllocatedMicro }))),
    checksTitle: "Run control",
    checksSubtitle: "allocation safety",
    checks: [
      check("Allocation runs endpoint loaded", "success"),
      check(`${formatCount(activeRuns)} active run(s)`, activeRuns > 0 ? "warning" : "success"),
      check("Server lock remains server-owned", "success")
    ],
    panels: lastRun === null ? [] : [allocationRunPanel(lastRun)],
    table: table(
      "Recent runs",
      "Preview",
      [
        { label: "Run", align: "left" },
        { label: "Input", align: "right" },
        { label: "Allocated", align: "right" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      runs.map((run: AllocationRunSummary): readonly TableCell[] => [
        textCell(run.id, true),
        moneyCell(formatMoney(run.totalInputMicro, "MUR"), "muted"),
        moneyCell(formatMoney(run.totalAllocatedMicro, "MUR"), moneyTone(run.totalAllocatedMicro)),
        badgeCell(run.status, runStatusTone(run.status)),
        actionCell("View", "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionSuspensePage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.distribution.listSuspense({
    workspaceId: workspaceRef,
    period,
    status: null,
    cursor: null,
    limit: 25
  });
  const items = response.items;
  const openItems = items.filter((item): boolean => item.status === "open");
  const missingSplitCount = items.filter((item): boolean => item.reason === "missing_split").length;
  const unmappedCount = items.filter((item): boolean => item.reason === "unmapped_track").length;

  return page({
    ...platformPages.di_suspense,
    subtitle: "Blockers grouped by reason and exact action.",
    kpis: [
      kpi("Suspense total", formatCount(items.length), "current page", items.length > 0 ? "warning" : "success", true),
      kpi("Open", formatCount(openItems.length), "items", openItems.length > 0 ? "warning" : "success", false),
      kpi("Missing split", formatCount(missingSplitCount), "contracts", missingSplitCount > 0 ? "warning" : "success", false),
      kpi("Unmapped", formatCount(unmappedCount), "mapping", unmappedCount > 0 ? "warning" : "success", false)
    ],
    chartTitle: "Blockers",
    chartSubtitle: "by reason",
    bars: barsFromCounts(groupCounts(items.map((item): string => item.reason))),
    checksTitle: "Fix path",
    checksSubtitle: "exact action",
    checks: [
      check("Suspense endpoint loaded", "success"),
      check(`${formatCount(openItems.length)} open item(s)`, openItems.length > 0 ? "warning" : "success"),
      check("Exact fix paths are server-provided", "success")
    ],
    table: table(
      "Blockers",
      "Resolve",
      [
        { label: "Reason", align: "left" },
        { label: "Source", align: "left" },
        { label: "Amount", align: "right" },
        { label: "Fix path", align: "left" },
        { label: "", align: "left" }
      ],
      items.map((item: SuspenseItem): readonly TableCell[] => [
        textCell(item.reason.replace(/_/gu, " "), true),
        textCell(item.sourceReference, false),
        moneyCell(formatMoney(item.amountMicro, item.currency), moneyTone(item.amountMicro)),
        textCell(item.exactFixPath, false),
        actionCell(item.status === "open" ? "Open" : "View", item.status === "open" ? "active" : "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionStatementsPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.distribution.listStatements({
    workspaceId: workspaceRef,
    period,
    payeeId: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const statements = response.items;
  const currency = statements[0]?.currency ?? "MUR";
  const gross = sumMoney(statements.map((statement): string => statement.grossMicro));
  const recouped = sumMoney(statements.map((statement): string => statement.recoupedMicro));
  const paid = sumMoney(statements.map((statement): string => statement.paidMicro));
  const totalDue = sumMoney(statements.map((statement): string => statement.netPayableMicro));

  return page({
    ...platformPages.di_state,
    subtitle: `Artist/payee statements · ${period}.`,
    kpis: [
      kpi("Revenue", formatMoney(gross, currency), "gross", "success", false),
      kpi("Recoup", formatMoney(recouped, currency), "applied", "warning", false),
      kpi("Paid", formatMoney(paid, currency), "recorded", "success", false),
      kpi("Total due", formatMoney(totalDue, currency), "payable", "active", true)
    ],
    chartTitle: "Statement lines",
    chartSubtitle: "by payee",
    bars: barsFromMoneyPoints(statements.map((statement): MoneyPoint => ({ label: statement.payeeName, amount: statement.netPayableMicro }))),
    checksTitle: "Generation",
    checksSubtitle: "statement API",
    checks: [
      check("Statements endpoint loaded", "success"),
      check(`${formatCount(statements.length)} statement(s)`, "info"),
      check("PDF generation remains server-side", "success")
    ],
    panels: [
      panel("Financial summary", `${period} · ${currency}`, [metric("Revenue", formatMoney(gross, currency), "success"), metric("Recoup", formatMoney(recouped, currency), "warning"), metric("Total due", formatMoney(totalDue, currency), "active")], [], ["Generate PDF"])
    ],
    table: table(
      "Statements",
      "Generate",
      [
        { label: "Payee", align: "left" },
        { label: "Gross", align: "right" },
        { label: "Recoup", align: "right" },
        { label: "Paid", align: "right" },
        { label: "Net", align: "right" },
        { label: "Status", align: "left" }
      ],
      statements.map((statement: StatementSummary): readonly TableCell[] => [
        textCell(statement.payeeName, true),
        moneyCell(formatMoney(statement.grossMicro, statement.currency), "success"),
        moneyCell(formatMoney(statement.recoupedMicro, statement.currency), "warning"),
        moneyCell(formatMoney(statement.paidMicro, statement.currency), "success"),
        moneyCell(formatMoney(statement.netPayableMicro, statement.currency), "active"),
        badgeCell(statement.status, statement.status === "paid" ? "success" : "warning")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionPaymentsPage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.distribution.listPayments({
    workspaceId: workspaceRef,
    period,
    payeeId: null,
    status: null,
    cursor: null,
    limit: 25
  });
  const payments = response.items;
  const currency = payments[0]?.currency ?? "MUR";
  const queuedPayments = payments.filter((payment): boolean => payment.status === "queued" || payment.status === "draft");
  const paidPayments = payments.filter((payment): boolean => payment.status === "paid");
  const voidedPayments = payments.filter((payment): boolean => payment.status === "voided");

  return page({
    ...platformPages.di_pay,
    subtitle: "Record, edit, void and reconcile through typed payment endpoints.",
    kpis: [
      kpi("To pay", formatMoney(sumMoney(queuedPayments.map((payment): string => payment.amountMicro)), currency), `${formatCount(queuedPayments.length)} payee(s)`, queuedPayments.length > 0 ? "warning" : "success", true),
      kpi("Paid", formatMoney(sumMoney(paidPayments.map((payment): string => payment.amountMicro)), currency), `${formatCount(paidPayments.length)} payment(s)`, "success", false),
      kpi("Void", formatCount(voidedPayments.length), "kept for audit", "muted", false),
      kpi("Rows", formatCount(payments.length), "current page", "info", false)
    ],
    chartTitle: "Payments",
    chartSubtitle: "state",
    bars: barsFromCounts(groupCounts(payments.map((payment): string => payment.status))),
    checksTitle: "Control",
    checksSubtitle: "before reconciliation",
    checks: [
      check("Payments endpoint loaded", "success"),
      check(`${formatCount(queuedPayments.length)} queued/draft payment(s)`, queuedPayments.length > 0 ? "warning" : "success"),
      check("Void rows remain visible", "success")
    ],
    table: table(
      "Payments",
      "Save",
      [
        { label: "Payee", align: "left" },
        { label: "Amount", align: "right" },
        { label: "Reference", align: "left" },
        { label: "Paid at", align: "left" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      payments.map((payment: PaymentSummary): readonly TableCell[] => [
        textCell(payment.payeeName, true),
        moneyCell(formatMoney(payment.amountMicro, payment.currency), moneyTone(payment.amountMicro)),
        textCell(payment.reference ?? "-", false),
        textCell(payment.paidAt === null ? "-" : shortDate(payment.paidAt), false),
        badgeCell(payment.status, paymentStatusTone(payment.status)),
        actionCell(payment.status === "paid" ? "View" : "Post", payment.status === "draft" || payment.status === "queued" ? "active" : "muted")
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

async function loadDistributionRevenuePage(client: EhqApiClient, workspaceRef: string, period: string): Promise<PlatformPage> {
  const response = await client.distribution.getRevenue({
    workspaceId: workspaceRef,
    period,
    payeeId: null,
    store: null,
    currency: null,
    groupBy: "store",
    cursor: null,
    limit: 25
  });
  const rows = response.items;
  const currency = rows[0]?.currency ?? "MUR";
  const gross = sumMoney(rows.map((row): string => row.grossMicro));
  const net = sumMoney(rows.map((row): string => row.netMicro));
  const payable = sumMoney(rows.map((row): string => row.payableMicro));

  return page({
    ...platformPages.di_rev,
    subtitle: `Financial view by store · ${period}.`,
    kpis: [
      kpi("Gross", formatMoney(gross, currency), period, "success", false),
      kpi("Net", formatMoney(net, currency), "after costs", "active", true),
      kpi("Payable", formatMoney(payable, currency), "statements", "warning", false),
      kpi("Rows", formatCount(rows.length), "current page", "muted", false)
    ],
    chartTitle: "By store",
    chartSubtitle: period,
    bars: rows.map((row: DistributionRevenueRow): BarPoint => bar(row.label, clampLevel(row.barLevel))),
    checksTitle: "View",
    checksSubtitle: "financial",
    checks: [
      check("Revenue endpoint loaded", "success"),
      check("Grouped by store", "success"),
      check(response.nextCursor === null ? "First page complete" : "More rows available", response.nextCursor === null ? "success" : "info")
    ],
    panels: [panel("Totals", period, [metric("Gross", formatMoney(gross, currency), "success"), metric("Net", formatMoney(net, currency), "active"), metric("Payable", formatMoney(payable, currency), "warning")], [], ["Export"])],
    table: table(
      "Revenue lines",
      "Filter",
      [
        { label: "Store", align: "left" },
        { label: "Gross", align: "right" },
        { label: "Net", align: "right" },
        { label: "Payable", align: "right" },
        { label: "Currency", align: "left" }
      ],
      rows.map((row: DistributionRevenueRow): readonly TableCell[] => [
        textCell(row.label, true),
        moneyCell(formatMoney(row.grossMicro, row.currency), "success"),
        moneyCell(formatMoney(row.netMicro, row.currency), "active"),
        moneyCell(formatMoney(row.payableMicro, row.currency), "warning"),
        textCell(row.currency, false)
      ])
    ),
    note: "Live read from the typed Distribution API."
  });
}

function distributionDashboardKpis(dashboard: DistributionDashboardResponse): readonly ReturnType<typeof kpi>[] {
  return [
    kpi("Gross royalties", formatMoney(dashboard.grossRoyaltyMicro, "MUR"), dashboard.period, "success", false),
    kpi("Recouped", formatMoney(dashboard.recoupedMicro, "MUR"), "applied", "warning", false),
    kpi("Net payable", formatMoney(dashboard.netPayableMicro, "MUR"), "payables", "active", true),
    kpi("Suspense", formatCount(dashboard.suspenseCount), "grouped by reason", dashboard.suspenseCount > 0 ? "warning" : "success", false)
  ];
}

function createOfficeTransactionsQuery(
  workspaceRef: string,
  period: string,
  status: OfficeTransaction["status"] | null
): Parameters<EhqApiClient["office"]["listTransactions"]>[0] {
  return {
    workspaceId: workspaceRef,
    period,
    accountId: null,
    departmentId: null,
    divisionId: null,
    categoryId: null,
    projectId: null,
    type: null,
    status,
    cursor: null,
    limit: 25
  };
}

function toOfficeImportRow(item: OfficeRecentImport): readonly TableCell[] {
  return [
    textCell(item.fileName, true),
    textCell(item.source.toUpperCase(), false),
    moneyCell(formatCount(item.acceptedRowCount), "muted"),
    textCell(item.periodLabel, false),
    badgeCell(item.status, item.status === "failed" ? "error" : item.status === "previewed" ? "info" : "success"),
    actionCell(item.status === "failed" ? "Retry" : "Review", item.status === "failed" ? "error" : "muted")
  ];
}

function toTreeRow(node: OfficePlanComptableNode): TreeRow {
  if (node.kind === "department") {
    return {
      depth: 1,
      label: node.label,
      meta: node.code,
      badge: "",
      tone: node.active ? "muted" : "warning",
      action: ""
    };
  }

  if (node.kind === "division") {
    return {
      depth: 2,
      label: node.label,
      meta: node.code,
      badge: "",
      tone: node.active ? "muted" : "warning",
      action: ""
    };
  }

  return {
    depth: 3,
    label: node.label,
    meta: node.code,
    badge: node.type,
    tone: node.type === "income" ? "success" : "error",
    action: ""
  };
}

function allocationRunPanel(run: AllocationRunSummary): DetailPanel {
  return panel(
    "Last run",
    run.completedAt ?? run.startedAt ?? run.period,
    [
      metric("Input", formatMoney(run.totalInputMicro, "MUR"), "muted"),
      metric("Allocated", formatMoney(run.totalAllocatedMicro, "MUR"), moneyTone(run.totalAllocatedMicro)),
      metric("Lock", run.lockKey, "info")
    ],
    [],
    ["Preview batch"]
  );
}

function commandCenterNote(pageId: PlatformPageId): string {
  if (pageId === "cc_users") {
    return "Command Center admin data still needs a typed API surface; auth permissions are real, this page is static for now.";
  }

  if (pageId === "cc_integ") {
    return "Integration health still needs a typed API surface; this page is static for now.";
  }

  if (pageId === "cc_settings") {
    return "Settings still need a typed API surface; this page is static for now.";
  }

  return "Command Center dashboard still needs a typed API surface; Office and Distribution pages now load via the API.";
}

function transactionSignedAmount(transaction: OfficeTransaction): string {
  if (transaction.type === "expense" && moneySign(transaction.amountMicro) > 0) {
    return negateMoney(transaction.amountMicro);
  }

  return transaction.amountMicro;
}

function transactionTone(transaction: OfficeTransaction): Tone {
  if (transaction.type === "income") {
    return "success";
  }

  if (transaction.type === "expense") {
    return "error";
  }

  return moneyTone(transaction.amountMicro);
}

function importStatusTone(status: DistributionImportBatch["status"]): Tone {
  if (status === "failed") {
    return "error";
  }

  if (status === "validated") {
    return "success";
  }

  if (status === "mapped") {
    return "info";
  }

  return "warning";
}

function runStatusTone(status: AllocationRunSummary["status"]): Tone {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed") {
    return "error";
  }

  return status === "running" ? "active" : "warning";
}

function paymentStatusTone(status: PaymentSummary["status"]): Tone {
  if (status === "paid") {
    return "success";
  }

  if (status === "voided") {
    return "muted";
  }

  return "warning";
}

function barsFromCounts(counts: readonly (readonly [string, number])[]): readonly BarPoint[] {
  const maxCount = counts.reduce((max: number, entry): number => Math.max(max, entry[1]), 0);
  return counts.map((entry): BarPoint => bar(entry[0], maxCount === 0 ? 0 : clampLevel(Math.ceil((entry[1] / maxCount) * 100))));
}

function barsFromMoneyPoints(points: readonly MoneyPoint[]): readonly BarPoint[] {
  const maxAmount = points.reduce((max: bigint, point): bigint => {
    const amount = absoluteBigInt(apiMoneyToMicroUnits(point.amount));
    return amount > max ? amount : max;
  }, 0n);

  if (maxAmount === 0n) {
    return points.map((point): BarPoint => bar(point.label, 0));
  }

  return points.map((point): BarPoint => {
    const level = Number((absoluteBigInt(apiMoneyToMicroUnits(point.amount)) * 100n) / maxAmount);
    return bar(point.label, clampLevel(level));
  });
}

function groupCounts(labels: readonly string[]): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()];
}

function topItems<TItem>(items: readonly TItem[], limit: number): readonly TItem[] {
  return items.slice(0, limit);
}

function formatMoney(amountValue: string, currency: CurrencyCode): string {
  const value = amountValue.trim();
  const prefix = currencyPrefix(currency);

  if (/^[+-]?\d+$/u.test(value)) {
    return formatMicroUnits(BigInt(value), prefix);
  }

  if (/^[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return formatDecimalAmount(value, prefix);
  }

  throw new Error(`Invalid API money value: ${amountValue}.`);
}

function formatSignedMoney(amountValue: string, currency: CurrencyCode): string {
  const formatted = formatMoney(amountValue, currency);
  if (moneySign(amountValue) > 0 && !formatted.startsWith("+")) {
    return `+${formatted}`;
  }

  return formatted;
}

function formatDecimalAmount(amountValue: string, prefix: string): string {
  const sign = amountValue.startsWith("-") ? "-" : "";
  const unsigned = amountValue.replace(/^[+-]/u, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const wholeText = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const fractionText = fraction.replace(/0+$/u, "");

  if (fractionText.length === 0) {
    return `${sign}${prefix}${wholeText}`;
  }

  return `${sign}${prefix}${wholeText}.${fractionText}`;
}

function formatMicroUnits(amount: bigint, prefix: string): string {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const units = absolute / 1_000_000n;
  const micros = absolute % 1_000_000n;
  const unitText = units.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");

  if (micros === 0n) {
    return `${sign}${prefix}${unitText}`;
  }

  return `${sign}${prefix}${unitText}.${micros.toString().padStart(6, "0")}`;
}

function currencyPrefix(currency: CurrencyCode): string {
  if (currency === "MUR") {
    return "Rs ";
  }

  if (currency === "USD") {
    return "US$ ";
  }

  if (currency === "EUR") {
    return "€ ";
  }

  return `${currency} `;
}

function moneyTone(amountValue: string): Tone {
  const sign = moneySign(amountValue);

  if (sign > 0) {
    return "success";
  }

  if (sign < 0) {
    return "error";
  }

  return "muted";
}

function moneySign(amountValue: string): -1 | 0 | 1 {
  const value = apiMoneyToMicroUnits(amountValue);
  if (value > 0n) {
    return 1;
  }

  if (value < 0n) {
    return -1;
  }

  return 0;
}

function sumMoney(values: readonly string[]): string {
  const total = values.reduce((sum: bigint, value: string): bigint => sum + apiMoneyToMicroUnits(value), 0n);
  return total.toString();
}

function addMoney(left: string, right: string): string {
  return (apiMoneyToMicroUnits(left) + apiMoneyToMicroUnits(right)).toString();
}

function negateMoney(value: string): string {
  return (-apiMoneyToMicroUnits(value)).toString();
}

function apiMoneyToMicroUnits(amountValue: string): bigint {
  const value = amountValue.trim();

  if (/^[+-]?\d+$/u.test(value)) {
    return BigInt(value);
  }

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (match === null) {
    throw new Error(`Invalid API money value: ${amountValue}.`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const wholeText = match[2] ?? "0";
  const fractionText = (match[3] ?? "").padEnd(6, "0").slice(0, 6);
  return sign * (BigInt(wholeText) * 1_000_000n + BigInt(fractionText));
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatBasisPoints(value: number): string {
  const whole = Math.trunc(value / 100);
  const fraction = String(value % 100).padStart(2, "0");
  return `${String(whole)}.${fraction}%`;
}

function basisPointsToLevel(value: number): number {
  return clampLevel(Math.trunc(value / 100));
}

function clampLevel(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function shortDate(value: string): string {
  return value.slice(0, 10);
}

function periodEndDate(period: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(period);
  if (match === null) {
    throw new Error(`Invalid period: ${period}. Expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(lastDay).padStart(2, "0")}`;
}
