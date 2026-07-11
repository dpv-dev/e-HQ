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

describe("office mutation refresh plans", () => {
  it("reconcile create refreshes reconciliation, ledger, and dashboard surfaces", () => {
    expectRefreshCalls("submitReconcileCreate", [
      "refreshReconciliationViews",
      "loadTransactions",
      "loadPendingTransactions",
      "loadDashboard",
      "loadDashboardAnalytics"
    ]);
  });

  it("pending classify and validate refresh dashboard analytics and reconciliation views", () => {
    expectRefreshCalls("classifySelectedPending", [
      "loadPendingTransactions",
      "loadTransactions",
      "loadDashboard",
      "loadDashboardAnalytics"
    ]);

    expectRefreshCalls("bulkValidatePending", [
      "loadPendingTransactions",
      "loadTransactions",
      "loadDashboard",
      "loadDashboardAnalytics",
      "refreshReconciliationViews"
    ]);
  });

  it("bank import confirm refreshes reconciliation operations through the shared refresh helper", () => {
    expectRefreshCalls("confirmImport", [
      "loadDashboard",
      "loadDashboardAnalytics",
      "loadTransactions",
      "loadPendingTransactions",
      "refreshReconciliationViews"
    ]);
  });
});
