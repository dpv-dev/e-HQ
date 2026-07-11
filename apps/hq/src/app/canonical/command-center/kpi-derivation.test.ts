import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");

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

describe("command-center KPI derivation", () => {
  it("derives integration KPIs from live overview rows", () => {
    const block = functionSource("createIntegrationKpis");
    expect(block).toContain("const bankConnectorCount = rows.filter");
    expect(block).toContain("const supabaseIntegration = rows.find");
    expect(block).not.toContain("value: \"2\"");
  });

  it("derives settings KPIs from live settings rows", () => {
    const block = functionSource("createSettingsKpis");
    expect(block).toContain("const reviewedCount = rows.filter");
    expect(block).toContain("const warningCount = rows.filter");
    expect(block).toContain("const lockedCount = rows.filter");
    expect(block).not.toContain("value: \"Admin\"");
    expect(block).not.toContain("value: \"Manual\"");
  });
});
