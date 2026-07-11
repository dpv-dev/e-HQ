#!/usr/bin/env node

const apiBase = process.env.EHQ_SMOKE_API_BASE ?? "https://api.eeee.mu";
const appBase = process.env.EHQ_SMOKE_APP_BASE ?? "https://app.eeee.mu";

const checks = [
  { label: "API health", url: `${apiBase}/healthz`, expected: 200 },
  { label: "App root", url: `${appBase}/`, expected: 200 },
  { label: "Office bank", url: `${appBase}/console/office/bank`, expected: 200 },
  { label: "Distribution settings", url: `${appBase}/console/distribution/settings`, expected: 200 },
  { label: "Command Center settings", url: `${appBase}/console/command-center/settings`, expected: 200 }
];

async function runCheck(check) {
  try {
    const response = await fetch(check.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "ehq-smoke-critical-routes/1.0"
      }
    });

    const ok = response.status === check.expected;
    return {
      ...check,
      status: response.status,
      ok,
      error: null
    };
  } catch (error) {
    return {
      ...check,
      status: -1,
      ok: false,
      error: error instanceof Error ? error.message : "unknown"
    };
  }
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
