import assert from "node:assert/strict";
import { createRestTransport, standardApiRetryPolicy } from "../packages/api-client/dist/transport.js";

let requestCount = 0;
const responseBody = JSON.stringify({ ok: true });
const transport = createRestTransport(
  {
    baseUrl: "https://api.example.test",
    fetch: async () => {
      requestCount += 1;
      return new Response(responseBody, { status: 200, headers: { "Content-Type": "application/json" } });
    },
    auth: { getAccessToken: async () => "cache-test-token" },
    retryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxRetryAfterMs: 0, retryableStatuses: [], retryMethods: ["GET"] },
    readCacheTtlMs: 5_000
  },
  "eof/v1"
);

const firstReads = await Promise.all([
  transport.get("screen/office", { workspaceId: "eeee-mu" }),
  transport.get("screen/office", { workspaceId: "eeee-mu" })
]);
assert.equal(requestCount, 1, "concurrent identical GETs must be deduplicated");
assert.deepEqual(firstReads[0], { ok: true });

await transport.get("screen/office", { workspaceId: "eeee-mu" });
assert.equal(requestCount, 1, "a GET within the read TTL must use the cache");

await transport.post("screen/office/refresh", {}, "cache-test-mutation");
await transport.get("screen/office", { workspaceId: "eeee-mu" });
assert.equal(requestCount, 3, "a mutation must invalidate the namespace read cache");

assert.equal(standardApiRetryPolicy.maxAttempts, 7, "standard GET retries must cover the startup window");
let retryRequestCount = 0;
const retryTransport = createRestTransport(
  {
    baseUrl: "https://api.example.test",
    fetch: async () => {
      retryRequestCount += 1;
      if (retryRequestCount < 7) {
        return new Response(JSON.stringify({ status: "starting" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "0" }
        });
      }
      return new Response(responseBody, { status: 200, headers: { "Content-Type": "application/json" } });
    },
    auth: { getAccessToken: async () => "retry-test-token" },
    retryPolicy: {
      maxAttempts: 7,
      baseDelayMs: 0,
      maxRetryAfterMs: 0,
      retryableStatuses: [503],
      retryMethods: ["GET"]
    },
    readCacheTtlMs: 0
  },
  "eof/v1"
);
await retryTransport.get("dashboard", { workspaceId: "eeee-mu", period: "2026-07" });
assert.equal(retryRequestCount, 7, "GET retries must accept a seventh successful startup attempt");

console.log("PASS API-client cache, mutation invalidation, and startup retry coverage");
