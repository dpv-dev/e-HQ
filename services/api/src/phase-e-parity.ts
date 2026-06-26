import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface ParityProbe {
  readonly label: string;
  readonly path: string;
  readonly expectedDivergence: "BUG-M1" | null;
}

interface ParityResult {
  readonly probe: ParityProbe;
  readonly status: "match" | "expected-divergence" | "mismatch";
  readonly detail: string;
}

const probes: readonly ParityProbe[] = [
  { label: "Office dashboard", path: "/eof/v1/dashboard?workspaceId=workspace_1&period=2026-02", expectedDivergence: null },
  { label: "Office global P&L", path: "/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02", expectedDivergence: null },
  { label: "Office transactions", path: "/eof/v1/transactions?workspaceId=workspace_1&period=2026-02&limit=25", expectedDivergence: null },
  { label: "Office project P&L", path: "/eof/v1/pl/project/project_kaya?workspaceId=workspace_1&period=2026-02", expectedDivergence: "BUG-M1" },
  { label: "Distribution dashboard", path: "/erh/v1/dashboard?workspaceId=workspace_1&period=2026-04", expectedDivergence: null },
  { label: "Distribution statements", path: "/erh/v1/statements?workspaceId=workspace_1&period=2026-04&limit=25", expectedDivergence: null },
  { label: "Distribution allocation runs", path: "/erh/v1/allocations/runs?workspaceId=workspace_1&limit=25", expectedDivergence: null },
  { label: "Distribution suspense", path: "/erh/v1/suspense?workspaceId=workspace_1&limit=25", expectedDivergence: null }
];

const honoBaseUrl = requireEnv("HONO_SHADOW_URL");
const wordpressBaseUrl = requireEnv("WP_BASE_URL");
const outputPath = resolve(process.env.PHASE_E_PARITY_REPORT ?? "reports/phaseE-parity.md");
const results: ParityResult[] = [];

for (const probe of probes) {
  results.push(await runProbe(probe, honoBaseUrl, wordpressBaseUrl));
}

await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(outputPath, formatReport(results, honoBaseUrl, wordpressBaseUrl), "utf8");
process.stdout.write(`${formatReport(results, honoBaseUrl, wordpressBaseUrl)}\n`);

if (results.some((result) => result.status === "mismatch")) {
  process.exit(1);
}

async function runProbe(probe: ParityProbe, honoBase: string, wordpressBase: string): Promise<ParityResult> {
  const [hono, wordpress] = await Promise.all([
    readJson(joinUrl(honoBase, probe.path), null),
    readJson(joinWordPressRestUrl(wordpressBase, probe.path), wordpressAuthHeader())
  ]);
  const honoJson = stableJson(hono);
  const wordpressJson = stableJson(wordpress);
  if (honoJson === wordpressJson) {
    return { probe, status: "match", detail: "JSON responses are identical after stable key ordering." };
  }

  if (probe.expectedDivergence === "BUG-M1") {
    return { probe, status: "expected-divergence", detail: "BUG-M1 documented: WordPress org-wide project/partner P&L can return zero while Hono reads migrated ledger totals." };
  }

  return { probe, status: "mismatch", detail: "JSON responses differ. Inspect Hono and WordPress bodies with the same path before cutover." };
}

async function readJson(url: string, authorization: string | null): Promise<unknown> {
  const headers = new Headers();
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Read-only parity GET failed for ${redactUrl(url)} with status ${String(response.status)}.`);
  }

  return await response.json();
}

function wordpressAuthHeader(): string | null {
  const user = process.env.WP_APP_USER;
  const password = process.env.WP_APP_PASSWORD;
  if (user === undefined || user.trim().length === 0 || password === undefined || password.trim().length === 0) {
    return null;
  }

  return `Basic ${btoa(`${user}:${password}`)}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
}

function joinWordPressRestUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  if (trimmed.endsWith("/wp-json")) {
    return joinUrl(trimmed, path);
  }

  return joinUrl(`${trimmed}/wp-json`, path);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJson(entry)]));
  }

  return value;
}

function formatReport(results: readonly ParityResult[], honoBase: string, wordpressBase: string): string {
  const matches = results.filter((result) => result.status === "match").length;
  const expected = results.filter((result) => result.status === "expected-divergence").length;
  const mismatches = results.filter((result) => result.status === "mismatch").length;
  return [
    "# Phase E parity report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Hono shadow: ${redactUrl(honoBase)}`,
    `WordPress: ${redactUrl(wordpressBase)}`,
    "",
    "## Summary",
    `Matches: ${String(matches)}`,
    `Expected divergences: ${String(expected)}`,
    `Mismatches: ${String(mismatches)}`,
    "",
    "## Probes",
    ...results.map((result) => `- ${result.status.toUpperCase()} — ${result.probe.label}: ${result.detail}`),
    "",
    "## Expected divergences",
    "- BUG-M1: WordPress org-wide project/partner P&L can return Rs 0; Hono reads the migrated ledger totals.",
    ""
  ].join("\n");
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${key} is required for Phase E parity.`);
  }

  return value;
}

function redactUrl(url: string): string {
  const parsed = new URL(url);
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}
