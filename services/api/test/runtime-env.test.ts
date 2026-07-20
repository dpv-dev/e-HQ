import assert from "node:assert/strict";
import test from "node:test";
import { applyRuntimeEnvText } from "../src/runtime-env.ts";

test("runtime env repairs a corrupted Hostinger write flag from the canonical env file", () => {
  const environment: Record<string, string | undefined> = {
    WRITES_ENABLED: "'true'SUPABASE_PUBLISHABLE_KEY=sb_publishable_example",
    SUPABASE_URL: "https://runtime.example"
  };

  applyRuntimeEnvText(environment, [
    "WRITES_ENABLED=true",
    "SUPABASE_URL=https://file.example"
  ].join("\n"));

  assert.equal(environment.WRITES_ENABLED, "true");
  assert.equal(environment.SUPABASE_URL, "https://runtime.example");
});

test("runtime env does not override an explicit valid write flag", () => {
  const environment: Record<string, string | undefined> = { WRITES_ENABLED: "false" };
  applyRuntimeEnvText(environment, "WRITES_ENABLED=true\n");
  assert.equal(environment.WRITES_ENABLED, "false");
});
