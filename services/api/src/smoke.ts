import { spawn } from "node:child_process";
import { resolve } from "node:path";

const host = "127.0.0.1";
const port = 8787;
const baseUrl = `http://${host}:${String(port)}`;
const readinessTimeoutMs = 20_000;
const readyPollDelayMs = 250;
const expectedIncomeMicro = "2214542460";
const expectedExpenseMicro = "1362642716";
const globalPnlUrl = "/eof/v1/pl/global?workspaceId=workspace_1&period=2026-02";

const server = spawn("node", [resolve(process.cwd(), "dist", "server.js")], {
  env: {
    ...process.env,
    HOST: host,
    PORT: String(port)
  },
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"]
});

let serverExitCode: number | null = null;
let serverExitSignal: string | null = null;
const serverExited = new Promise<void>((resolveExit) => {
  server.on("exit", (exitCode, exitSignal) => {
    serverExitCode = exitCode;
    serverExitSignal = exitSignal;
    resolveExit();
  });
});

let failure = false;
try {
  await waitForReady();
  const health = await readJson(`${baseUrl}/healthz`);
  if (typeof health !== "object" || health === null || (health as Record<string, unknown>).status !== "ok") {
    throw new Error("SMOKE FAIL: /healthz does not return status=ok.");
  }

  const globalPnl = (await readJson(`${baseUrl}${globalPnlUrl}`)) as {
    readonly incomeMicro: string;
    readonly expenseMicro: string;
  };
  const failures: string[] = [];
  if (globalPnl.incomeMicro !== expectedIncomeMicro) {
    failures.push(`income expected ${expectedIncomeMicro} but got ${globalPnl.incomeMicro}`);
  }
  if (globalPnl.expenseMicro !== expectedExpenseMicro) {
    failures.push(`expense expected ${expectedExpenseMicro} but got ${globalPnl.expenseMicro}`);
  }

  if (failures.length > 0) {
    throw new Error(`SMOKE FAIL: /eof/v1/pl/global mismatch -> ${failures.join("; ")}`);
  }

  process.stdout.write(
    `SMOKE PASS incomeMicro=${globalPnl.incomeMicro} expenseMicro=${globalPnl.expenseMicro}\n`
  );
} catch (error) {
  process.stdout.write(`${String(error instanceof Error ? error.message : error)}\n`);
  failure = true;
} finally {
  await terminate();
}

if (serverExitCode !== null && serverExitCode !== 0) {
  process.stdout.write(`SMOKE FAIL: shadow server exited with code=${String(serverExitCode)} signal=${String(serverExitSignal ?? "none")}.\n`);
  failure = true;
}
if (failure) {
  process.exit(1);
}

async function waitForReady(): Promise<void> {
  const startedAt = Date.now();
  let lastError = "timeout";
  while (Date.now() - startedAt < readinessTimeoutMs) {
    if (serverExitCode !== null && serverExitCode !== 0) {
      throw new Error(`SMOKE FAIL: shadow server exited early with code=${String(serverExitCode)} signal=${String(serverExitSignal ?? "none")}.`);
    }

    try {
      const response = await readJson(`${baseUrl}/healthz`);
      if (typeof response === "object" && response !== null && (response as Record<string, unknown>).status === "ok") {
        return;
      }
      lastError = "healthz returned non-ok status";
    } catch (error) {
      lastError = String(error instanceof Error ? error.message : error);
    }

    await sleep(readyPollDelayMs);
  }

  throw new Error(`SMOKE FAIL: shadow server not ready after ${String(readinessTimeoutMs / 1000)}s; last error: ${lastError}`);
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`SMOKE FAIL: GET ${url} returned ${String(response.status)} ${response.statusText}`);
  }

  return await response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function terminate(): Promise<void> {
  server.kill("SIGTERM");
  try {
    await Promise.race([
      serverExited,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("SMOKE FAIL: shadow server shutdown timed out.")), 5_000);
      })
    ]);
  } catch (error) {
    process.stdout.write(`${String(error instanceof Error ? error.message : error)}\n`);
    server.kill("SIGKILL");
  }
}
