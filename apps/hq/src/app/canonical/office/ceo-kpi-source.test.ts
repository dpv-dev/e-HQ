import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CeoView.svelte", import.meta.url), "utf8");

function functionSource(name: string): string {
  const startMarker = `function ${name}`;
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);

  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const nextSync = source.indexOf("\n  function ", start + 1);
  const boundaries = [nextAsync, nextSync].filter((value): value is number => value !== -1);
  const end = boundaries.length === 0 ? source.length : Math.min(...boundaries);

  return source.slice(start, end);
}

describe("office CEO KPI source wiring", () => {
  it("loads dashboard and P&L only from Office API client methods", () => {
    const loadBlock = source.slice(source.indexOf("async function loadCeo"), source.indexOf("async function loadMoreDivisions"));
    expect(loadBlock).toContain("props.client.getDashboard(");
    expect(loadBlock).toContain("props.client.getGlobalPnl(");
    expect(loadBlock).toContain("props.client.getDivisionPnl(");
  });

  it("derives KPI values from API payload fields, not hardcoded literals", () => {
    const block = functionSource("createCeoKpis");
    expect(block).toContain("globalPnl.data.netMicro");
    expect(block).toContain("globalPnl.data.incomeMicro");
    expect(block).toContain("globalPnl.data.expenseMicro");
    expect(block).toContain("dashboard.data.cashBalanceMicro");
    expect(block).toContain("dashboard.data.unreconciledTransactionCount");
    expect(block).not.toContain('value: "120 000 MUR"');
    expect(block).not.toContain('value: "95 000 MUR"');
  });
});
