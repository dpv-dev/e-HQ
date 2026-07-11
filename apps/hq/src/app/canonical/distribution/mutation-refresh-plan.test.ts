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
      "loadDashboard",
      "loadSuspense",
      "loadRevenue",
      "loadReconciliation",
      "loadAuditLog"
    ]);

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
