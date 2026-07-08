#!/usr/bin/env node
// Daily FX refresh for ë • office.
//
// Fetches EUR→MUR (and any other configured source→MUR cross-rate) from
// exchangerate-api's free, key-less endpoint and upserts it into the office
// `exchange_rates` table. The office books are kept in MUR, so this is what lets
// foreign-currency bank lines (e.g. EUR statements) be consolidated into the
// MUR P&L/stats at import time — `parseOfficeBankPreviewRow` reads this table.
//
// Decoupled connector: it only needs `pg` (shipped in the API deploy folder) and
// Node 20+ global `fetch`. Run it from the API deploy folder and schedule it once
// a day via the Hostinger cron:
//   node scripts/refresh-fx.mjs
// Reads DATABASE_URL from the environment (same value as the API slot).
//
// NOTE: the ECB / Frankfurter feeds do NOT publish the Mauritian rupee, hence
// exchangerate-api (which does) is used instead.

import { Pool } from "pg";

const PROVIDER_URL = "https://open.er-api.com/v6/latest/EUR";
const TARGET_CURRENCIES = ["EUR"]; // source currencies the office holds; all converted → MUR
const MAX_ATTEMPTS = 3;

function logLine(level, fields) {
  const line = { level, ...fields };
  if (level === "error") {
    console.error(JSON.stringify(line));
  } else if (level === "warn") {
    console.warn(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
}

function rateToE10(rate) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate received: ${String(rate)}`);
  }
  return BigInt(Math.round(rate * 1e10)); // rate_e10 = rate × 10^10
}

function effectiveDateFromUnix(unixSeconds) {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) {
    throw new Error(`Invalid time_last_update_unix: ${String(unixSeconds)}`);
  }
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

// Cross-rate (MUR per 1 source unit) from an EUR-based payload.
function crossRateToMur(rates, sourceCurrency) {
  const murPerEur = rates.MUR;
  if (typeof murPerEur !== "number") {
    throw new Error("Provider payload missing EUR→MUR rate (rates.MUR)");
  }
  if (sourceCurrency === "EUR") {
    return murPerEur;
  }
  const sourcePerEur = rates[sourceCurrency];
  if (typeof sourcePerEur !== "number" || sourcePerEur <= 0) {
    throw new Error(`Provider payload missing rate for ${sourceCurrency}`);
  }
  return murPerEur / sourcePerEur;
}

async function fetchPayload() {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(PROVIDER_URL, { headers: { accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`FX provider HTTP ${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      if (payload.result !== "success") {
        throw new Error(`FX provider returned result=${String(payload.result)}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      logLine("warn", { msg: "fx_fetch_failed", attempt, maxAttempts: MAX_ATTEMPTS, error: String(error?.message ?? error) });
    }
  }
  throw new Error(`FX fetch failed after ${MAX_ATTEMPTS} attempts: ${String(lastError?.message ?? lastError)}`);
}

function sslFromUrl(databaseUrl) {
  // Supabase's pooler always requires SSL and presents a self-signed chain.
  // Force { rejectUnauthorized: false } for any Supabase/pooler URL, and also
  // when the caller already set sslmode=no-verify or sslmode=require explicitly.
  if (
    databaseUrl.includes("supabase.com") ||
    databaseUrl.includes("pooler.supabase") ||
    databaseUrl.includes("sslmode=no-verify") ||
    databaseUrl.includes("sslmode=require")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error("DATABASE_URL is required");
  }

  const payload = await fetchPayload();
  const effectiveDate = effectiveDateFromUnix(payload.time_last_update_unix);
  const pool = new Pool({ connectionString: databaseUrl, ssl: sslFromUrl(databaseUrl) });

  try {
    for (const sourceCurrency of TARGET_CURRENCIES) {
      const rate = crossRateToMur(payload.rates, sourceCurrency);
      const rateE10 = rateToE10(rate);
      await pool.query(
        `insert into exchange_rates (from_currency, to_currency, rate_e10, effective_date)
         values ($1, 'MUR', $2, $3)
         on conflict (from_currency, to_currency, effective_date)
         do update set rate_e10 = excluded.rate_e10`,
        [sourceCurrency, rateE10.toString(), effectiveDate]
      );
      logLine("info", { msg: "fx_upserted", fromCurrency: sourceCurrency, toCurrency: "MUR", rate, rateE10: rateE10.toString(), effectiveDate });
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logLine("error", { msg: "fx_refresh_failed", error: String(error?.message ?? error) });
  process.exitCode = 1;
});
