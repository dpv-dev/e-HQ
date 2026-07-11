import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");

function functionSource(name: string): string {
  const startMarker = `function ${name}`;
  const asyncStartMarker = `async function ${name}`;
  const start = source.indexOf(asyncStartMarker) === -1 ? source.indexOf(startMarker) : source.indexOf(asyncStartMarker);
  expect(start).toBeGreaterThan(-1);

  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const nextSync = source.indexOf("\n  function ", start + 1);
  const boundaries = [nextAsync, nextSync].filter((value): value is number => value !== -1);
  const end = boundaries.length === 0 ? source.length : Math.min(...boundaries);

  return source.slice(start, end);
}

describe("command-center notifications flow", () => {
  it("loads notifications from the API", () => {
    const block = functionSource("loadNotifications");
    expect(block).toContain("client.commandCenter.listNotifications");
    expect(block).toContain("unreadNotifications = notifications.unreadCount");
  });

  it("refreshes notifications when dashboard period filter triggers a data refresh", () => {
    const block = functionSource("selectDashboardToolbarFilter");
    expect(block).toContain("Promise.all([loadCommandOverview(), loadNotifications()])");
  });

  it("reloads notifications after command-center writes", () => {
    expect(functionSource("requestAccessReview")).toContain("Promise.all([loadCommandOverview(), loadNotifications()])");
    expect(functionSource("persistCommandSetting")).toContain("Promise.all([loadCommandOverview(), loadNotifications()])");
    expect(functionSource("toggleIntegration")).toContain("Promise.all([loadCommandOverview(), loadNotifications()])");
  });
});
