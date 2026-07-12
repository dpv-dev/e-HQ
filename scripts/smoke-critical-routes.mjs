#!/usr/bin/env node

const apiBase = process.env.EHQ_SMOKE_API_BASE ?? "https://api.eeee.mu";
const appBase = process.env.EHQ_SMOKE_APP_BASE ?? "https://app.eeee.mu";
const healthRetryCount = Number.parseInt(process.env.EHQ_SMOKE_HEALTH_RETRIES ?? "4", 10);
const healthRetryDelayMs = Number.parseInt(process.env.EHQ_SMOKE_HEALTH_RETRY_DELAY_MS ?? "1500", 10);

const officeRoutes = [
  "dashboard",
  "ceo",
  "bank",
  "audit",
  "vat",
  "settings",
  "clients",
  "suppliers",
  "projects",
  "monitoring",
  "transactions",
  "imports",
  "wave-invoices",
  "reconciliation",
  "pending",
  "cashflow",
  "coa",
  "pnl"
];

const distributionRoutes = [
  "dashboard",
  "imports",
  "mapping",
  "catalog",
  "contracts",
  "allocations",
  "suspense",
  "statements",
  "payments",
  "revenue",
  "financial-reconciliation",
  "aliases",
  "duplicates",
  "audit-log",
  "settings"
];

const checks = [
  { label: "API health", url: `${apiBase}/healthz`, expected: 200 },
  { label: "App root", url: `${appBase}/`, expected: 200 },
  ...officeRoutes.map((route) => ({
    label: `Office ${route}`,
    url: `${appBase}/console/office/${route}`,
    expected: 200
  })),
  ...distributionRoutes.map((route) => ({
    label: `Distribution ${route}`,
    url: `${appBase}/console/distribution/${route}`,
    expected: 200
  })),
  { label: "Command Center dashboard", url: `${appBase}/console/command-center/dashboard`, expected: 200 },
  { label: "Command Center settings", url: `${appBase}/console/command-center/settings`, expected: 200 }
];

async function runCheck(check) {
  const attempts = check.label === "API health" ? healthRetryCount : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(check.url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "ehq-smoke-critical-routes/1.0"
        }
      });

      const ok = response.status === check.expected;
      if (ok || attempt === attempts || response.status !== 503) {
        return {
          ...check,
          status: response.status,
          ok,
          error: null
        };
      }
    } catch (error) {
      if (attempt === attempts) {
        return {
          ...check,
          status: -1,
          ok: false,
          error: error instanceof Error ? error.message : "unknown"
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, healthRetryDelayMs));
  }

  return {
    ...check,
    status: -1,
    ok: false,
    error: "unknown"
  };
}

async function main() {
  const results = [];

  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
  }

  let failures = 0;

  for (const result of results) {
    if (result.ok) {
      console.log(`PASS ${result.label} -> ${result.status} ${result.url}`);
      continue;
    }

    failures += 1;
    const errorSuffix = result.error === null ? "" : ` error=${result.error}`;
    console.error(
      `FAIL ${result.label} -> expected ${result.expected}, got ${result.status} ${result.url}${errorSuffix}`
    );
  }

  if (failures > 0) {
    console.error(`Critical smoke failed with ${String(failures)} failure(s).`);
    process.exit(1);
  }

  console.log("Critical smoke passed.");
}

await main();
