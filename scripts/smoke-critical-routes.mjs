#!/usr/bin/env node

const apiBase = process.env.EHQ_SMOKE_API_BASE ?? "https://api.eeee.mu";
const appBase = process.env.EHQ_SMOKE_APP_BASE ?? "https://app.eeee.mu";

const checks = [
  { label: "API liveness", url: `${apiBase}/healthz`, expected: 200, maxAttempts: 7 },
  { label: "API readiness", url: `${apiBase}/readyz`, expected: 200, maxAttempts: 7 },
  { label: "App root", url: `${appBase}/`, expected: 200, maxAttempts: 3 },
  { label: "Office bank", url: `${appBase}/console/office/bank`, expected: 200, maxAttempts: 3 },
  { label: "Distribution settings", url: `${appBase}/console/distribution/settings`, expected: 200, maxAttempts: 3 },
  { label: "Command Center settings", url: `${appBase}/console/command-center/settings`, expected: 200, maxAttempts: 3 }
];

async function runCheck(check) {
  let lastStatus = -1;
  let lastError = null;
  let attempts = 0;
  for (let attempt = 1; attempt <= check.maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      const response = await fetch(check.url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "ehq-smoke-critical-routes/1.0"
        }
      });
      lastStatus = response.status;
      lastError = null;
      if (response.status === check.expected) {
        return { ...check, status: response.status, ok: true, error: null, attempts: attempt };
      }
      if (attempt < check.maxAttempts && isRetryableStatus(response.status)) {
        await sleep(retryDelayMs(response.headers.get("Retry-After"), attempt));
        continue;
      }
    } catch (error) {
      lastStatus = -1;
      lastError = error instanceof Error ? error.message : "unknown";
      if (attempt < check.maxAttempts) {
        await sleep(retryDelayMs(null, attempt));
        continue;
      }
    }
    break;
  }
  return { ...check, status: lastStatus, ok: false, error: lastError, attempts };
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(retryAfter, attempt) {
  if (retryAfter !== null && /^\d+$/.test(retryAfter.trim())) {
    return Math.min(5_000, Number(retryAfter.trim()) * 1_000);
  }
  return Math.min(5_000, 500 * (2 ** (attempt - 1)));
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
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
      console.log(`PASS ${result.label} -> ${result.status} ${result.url} attempts=${result.attempts}`);
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
