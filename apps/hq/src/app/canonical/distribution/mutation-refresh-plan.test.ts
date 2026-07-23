import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");

function functionSource(name: string): string {
  const startMarker = `async function ${name}`;
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);

  const nextAsync = source.indexOf("\n  async function ", start + startMarker.length);
  const nextSync = source.indexOf("\n  function ", start + startMarker.length);
  const boundaries = [nextAsync, nextSync].filter((value): value is number => value !== -1);
  const end = boundaries.length === 0 ? source.length : Math.min(...boundaries);

  return source.slice(start, end);
}

function expectRefreshCalls(name: string, calls: readonly string[]): void {
  const block = functionSource(name);

  for (const call of calls) {
    expect(block).toContain(`${call}()`);
  }
}

describe("distribution mutation refresh plans", () => {
  it("routes issue actions to pinpoint queues with preserved entity context", () => {
    expect(source).toContain('label: dashboardFixLabel');
    expect(source).toContain('label: suspenseFixLabel');
    expect(source).toContain('label: (rowId: string): string => `Fix ${humanizeIssueCode(rowId)} queue`');
    expect(source).toContain('showAllImportedDataForIssue();');
    expect(source).toContain('suspenseReasonFilter = reasonCode;');
    expect(source).toContain('contractWorkflowFilter = "needs_attention";');
    expect(source).toContain('mappingStatusFilter = "unmapped";');
    expect(source).toContain('catalogReviewFilter = "needs_review";');
  });

  it("import mutations refresh mapping, suspense, revenue, reconciliation, and audit surfaces", () => {
    expectRefreshCalls("reverseImportBatch", [
      "loadImportBatches",
      "loadMappingRows",
      "loadDashboard",
      "loadSuspense",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);

    expectRefreshCalls("confirmImport", [
      "loadImportBatches",
      "loadMappingRows",
      "loadCatalog",
      "loadDashboard",
      "loadAllocationWorkbench",
      "loadAllocationRuns",
      "loadSuspense",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);

    const confirmation = functionSource("confirmImport");
    expect(confirmation).toContain("generateTracksFromImportBatch(");
    expect(confirmation).toContain("startCadencedAllocationRun(");

    expectRefreshCalls("applyMappingRules", [
      "loadMappingRows",
      "loadSuspense",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);
  });

  it("allocation mutations refresh downstream financial and audit surfaces", () => {
    expectRefreshCalls("startCadencedAllocationRun", [
      "loadAllocationRuns",
      "loadStatements",
      "loadPayments",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);

    expectRefreshCalls("unpostAllocationRun", [
      "loadAllocationRuns",
      "loadStatements",
      "loadPayments",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);
  });

  it("surfaces structured API errors in the action banner", () => {
    expect(source).toContain("error instanceof ApiClientHttpError");
    expect(source).toContain("apiErrorMessage(error.responseBody)");
    expect(source).toContain('JSON.parse(responseBody)');
  });

  it("payment mutations refresh statements, reconciliation, revenue, and audit views", () => {
    expectRefreshCalls("recordPayment", [
      "loadPayments",
      "loadStatements",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);

    expectRefreshCalls("voidPayment", [
      "loadPayments",
      "loadStatements",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);
  });
});
