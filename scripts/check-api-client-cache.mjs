import assert from "node:assert/strict";
import { createRestTransport } from "../packages/api-client/dist/transport.js";

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

console.log("PASS API-client GET deduplication, TTL cache, and mutation invalidation");