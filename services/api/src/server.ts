import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { dirname, resolve } from "node:path";
import { createSupabaseJwtAuthConfig, createSupabaseJwtVerifier } from "./auth.js";
import { createApiService } from "./index.js";
import { startPostgresApiRuntime } from "./postgres.js";

const envFilePath = resolveRootEnvPath(process.cwd());
if (existsSync(envFilePath)) {
  const envFile = readFileSync(envFilePath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    let value = trimmedLine.slice(equalsIndex + 1).trim();
    if (value.length === 0) {
      if (process.env[key] === undefined) {
        process.env[key] = "";
      }

      continue;
    }

    const quote = value[0];
    if ((quote === "\"" && value.endsWith("\"")) || (quote === "'" && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

void bootServer();

async function bootServer(): Promise<void> {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = parsePort(process.env.PORT ?? 8787);
  process.stdout.write(`eHQ Hono API booting on http://${host}:${String(port)}\n`);

  // Hostinger requires listen() within 3 seconds. Start both data phases without
  // awaiting them, then bind immediately. Hono gates each business route on the
  // phase it consumes; /healthz remains an immediate liveness endpoint.
  process.stdout.write("eHQ Hono API connecting to Postgres...\n");
  let runtime: ReturnType<typeof startPostgresApiRuntime>;
  try {
    runtime = startPostgresApiRuntime(process.env);
  } catch (error: unknown) {
    writeBootError(error);
    process.exit(1);
    return;
  }

  const app = createApiService({
    fixtures: runtime.fixtures,
    persistence: runtime.persistence,
    health: runtime.health,
    readiness: runtime.readiness,
    nowIso: (): string => new Date().toISOString(),
    auth: createSupabaseJwtVerifier(createSupabaseJwtAuthConfig(process.env))
  });

  const server = createServer((request, response) => {
    void handleRequestWithApp(app, host, port, request, response).catch((error: unknown) => {
      writeRequestError(error, response);
    });
  });

  server.listen(port, host, () => {
    const serverWithAddress = server as unknown as { address: () => { port: number } | string | null };
    const boundAddress = serverWithAddress.address();
    const resolvedPort = typeof boundAddress === "object" && boundAddress !== null ? boundAddress.port : port;
    process.stdout.write(`eHQ Hono API listening on http://${host}:${String(resolvedPort)} (data phases loading...)\n`);
  });

  let shuttingDown = false;
  const stop = (code: number, error: unknown | null): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (error !== null) {
      writeBootError(error);
    }
    void shutdown(server, runtime, code).catch((shutdownError: unknown) => {
      writeBootError(shutdownError);
      process.exit(code);
    });
  };

  void runtime.readiness.waitUntilReady().then(() => {
    const startup = runtime.readiness.snapshot();
    process.stdout.write(`eHQ Hono API ready in ${String(startup.durationMs ?? 0)}ms\n`);
  }).catch((error: unknown) => {
    stop(1, error);
  });

  process.on("SIGINT", () => {
    stop(0, null);
  });
  process.on("SIGTERM", () => {
    stop(0, null);
  });
}

async function handleRequestWithApp(
  app: ReturnType<typeof createApiService>,
  host: string,
  port: number,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const method = request.method ?? "GET";
  const requestUrl = `http://${headerHost(request.headers.host, host, port)}${request.url ?? "/"}`;
  const body = method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(request);
  const honoResponse = await app.fetch(
    new Request(requestUrl, {
      method,
      headers: headersFromIncoming(request.headers),
      body,
      duplex: body === undefined ? undefined : "half"
    } as RequestInit)
  );

  response.writeHead(honoResponse.status, responseHeaders(honoResponse.headers));
  if (honoResponse.body === null) {
    response.end();
    return;
  }

  const nodeBody = Readable.fromWeb(honoResponse.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  nodeBody.pipe(response as unknown as Parameters<typeof nodeBody.pipe>[0]);
}

function parsePort(rawPort: string | number): number {
  const value = String(rawPort).trim();
  if (!/^\d+$/u.test(value)) {
    throw new Error(`PORT must be an integer, got ${value}.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`PORT is outside the valid TCP port range: ${value}.`);
  }

  return parsed;
}

function headerHost(value: string | readonly string[] | undefined, host: string, port: number): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return `${host}:${String(port)}`;
}

function headersFromIncoming(headers: Readonly<Record<string, string | readonly string[] | undefined>>): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      result.set(key, value);
      continue;
    }

    result.set(key, value.join(", "));
  }

  return result;
}

function responseHeaders(headers: Headers): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function shutdown(server: ReturnType<typeof createServer>, runtime: { close: () => Promise<void> }, code: number): Promise<never> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
  await runtime.close();
  process.exit(code);
}

function writeBootError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`eHQ Hono API shadow boot failed: ${error.message}`);
    if (error.stack !== undefined) {
      console.error(error.stack);
    }
    return;
  }

  console.error(`eHQ Hono API shadow boot failed: ${String(error)}`);
}

function writeRequestError(error: unknown, response: ServerResponse): void {
  console.error(`eHQ Hono API request bridge failed: ${error instanceof Error ? error.message : String(error)}`);
  if (response.headersSent) {
    response.destroy(error instanceof Error ? error : undefined);
    return;
  }
  response.writeHead(500, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    error: {
      code: "api_request_bridge_failed",
      message: "The API request could not be completed.",
      context: []
    }
  }));
}

function resolveRootEnvPath(startPath: string): string {
  let currentDirectory = startPath;
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const candidate = resolve(currentDirectory, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (existsSync(resolve(currentDirectory, ".git"))) {
      break;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return resolve(startPath, ".env");
}
