import type { BotAbility, BotRole } from "./abilities.js";

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;

export interface BotGatewayConfig {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly role: BotRole;
  readonly workspaceId: string;
  readonly healthLatencyThresholdMs: number;
  readonly requestTimeoutMs: number;
  readonly retryCount: number;
}

export interface BotToolInput {
  readonly workspaceId?: string;
  readonly period?: string;
  readonly query?: JsonObject;
  readonly pathParams?: JsonObject;
  readonly body?: JsonObject;
  readonly idempotencyKey?: string;
  readonly dryRun?: boolean;
}

export interface HttpRequestPlan {
  readonly url: URL;
  readonly init: RequestInit;
  readonly body: JsonObject | null;
}

interface RateLimiterState {
  readonly capacity: number;
  readonly refillPerMinute: number;
  tokens: number;
  updatedAtMs: number;
}

interface CircuitBreakerState {
  pausedUntilMs: number;
  lastFailure: string | null;
}

export interface BotGuardState {
  readonly inFlightWrites: Set<BotRole>;
  readonly financialLocks: Set<string>;
  readonly rateLimiters: Map<BotRole, RateLimiterState>;
  readonly circuitBreaker: CircuitBreakerState;
}

export class BotGatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;
  readonly context: readonly string[];

  constructor(status: number, code: string, message: string, retryAfterSeconds: number | null, context: readonly string[]) {
    super(message);
    this.name = "BotGatewayError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.context = context;
  }
}

export function createBotGuardState(): BotGuardState {
  return {
    inFlightWrites: new Set<BotRole>(),
    financialLocks: new Set<string>(),
    rateLimiters: new Map<BotRole, RateLimiterState>(),
    circuitBreaker: {
      pausedUntilMs: 0,
      lastFailure: null
    }
  };
}

export async function withBotWriteGuards<TResult>(
  config: BotGatewayConfig,
  state: BotGuardState,
  ability: BotAbility,
  input: BotToolInput,
  callback: () => Promise<TResult>
): Promise<TResult> {
  if (ability.mode !== "write") {
    return callback();
  }

  assertCircuitClosed(state, Date.now());
  assertRateLimit(config, state, Date.now());
  assertIdempotencyKey(input, ability);
  assertPayloadCap(ability, input.body ?? null);

  const lockKey = financialLockKey(config, ability, input);
  if (state.inFlightWrites.has(config.role)) {
    throw new BotGatewayError(423, "bot_write_in_flight", "This bot already has one write in flight; retry later.", 2, [
      `role=${config.role}`,
      `ability=${ability.name}`
    ]);
  }

  if (lockKey !== null && state.financialLocks.has(lockKey)) {
    throw new BotGatewayError(423, "financial_lock_in_flight", "A financial run is already in flight for this scope; retry later.", 5, [
      `role=${config.role}`,
      `ability=${ability.name}`,
      `lockKey=${lockKey}`
    ]);
  }

  state.inFlightWrites.add(config.role);
  if (lockKey !== null) {
    state.financialLocks.add(lockKey);
  }

  try {
    await assertHealthy(config, state);
    return await callback();
  } finally {
    state.inFlightWrites.delete(config.role);
    if (lockKey !== null) {
      state.financialLocks.delete(lockKey);
    }
  }
}

export function validateBotWriteEnvelope(ability: BotAbility, input: BotToolInput): void {
  if (ability.mode !== "write") {
    return;
  }

  assertIdempotencyKey(input, ability);
  assertPayloadCap(ability, input.body ?? null);
}

export async function fetchWithBoundedRetry(config: BotGatewayConfig, request: HttpRequestPlan): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt <= config.retryCount) {
    const controller = new AbortController();
    const timeout = setTimeout((): void => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(request.url, {
        ...request.init,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!shouldRetryResponse(response) || attempt === config.retryCount) {
        return response;
      }

      await wait(retryDelayMs(response, attempt));
    } catch (error: unknown) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error("Unknown fetch failure.");
      if (attempt === config.retryCount) {
        throw lastError;
      }

      await wait(backoffMs(attempt));
    }

    attempt += 1;
  }

  throw lastError ?? new Error("HTTP request failed without an error.");
}

export function buildRequestPlan(config: BotGatewayConfig, ability: BotAbility, input: BotToolInput): HttpRequestPlan {
  const path = materializePath(ability.pathTemplate, input.pathParams ?? {});
  const url = new URL(path, withTrailingSlash(config.apiBaseUrl));
  const query = input.query ?? {};
  const requestWorkspaceId = input.workspaceId ?? config.workspaceId;
  url.searchParams.set("workspaceId", requestWorkspaceId);

  if (input.period !== undefined && input.period.trim().length > 0) {
    url.searchParams.set("period", input.period.trim());
  }

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim().length > 0) {
      url.searchParams.set(key, value.trim());
    }
  }

  const body = bodyWithWorkspace(input.body ?? null, requestWorkspaceId);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${config.token}`);
  headers.set("Content-Type", "application/json");
  if (ability.mode === "write") {
    headers.set("Idempotency-Key", input.idempotencyKey ?? "");
  }

  const init: RequestInit = {
    method: ability.method,
    headers
  };

  if (ability.method !== "GET") {
    init.body = JSON.stringify(body ?? { workspaceId: requestWorkspaceId });
  }

  return {
    url,
    init,
    body
  };
}

export function parseBotRole(value: string | undefined): BotRole {
  if (value === "bot_office") {
    return "bot_office";
  }

  if (value === "bot_distribution") {
    return "bot_distribution";
  }

  throw new BotGatewayError(500, "bot_role_unconfigured", "EHQ_BOT_ROLE must be bot_office or bot_distribution.", null, [
    `EHQ_BOT_ROLE=${value ?? "undefined"}`
  ]);
}

export function parseRequiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim().length === 0) {
    throw new BotGatewayError(500, "bot_env_missing", "A required bot gateway environment variable is missing.", null, [
      `env=${key}`
    ]);
  }

  return value.trim();
}

export function parseOptionalEnv(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
}

export function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BotGatewayError(500, "bot_env_invalid", "A bot gateway numeric environment variable must be a positive integer.", null, [
      `env=${key}`,
      `value=${value}`
    ]);
  }

  return parsed;
}

function assertCircuitClosed(state: BotGuardState, nowMs: number): void {
  if (state.circuitBreaker.pausedUntilMs <= nowMs) {
    return;
  }

  const retryAfterMs = state.circuitBreaker.pausedUntilMs - nowMs;
  throw new BotGatewayError(503, "bot_circuit_open", "Bot write routes are paused because the API health probe failed.", Math.ceil(retryAfterMs / 1000), [
    `lastFailure=${state.circuitBreaker.lastFailure ?? "unknown"}`
  ]);
}

function assertRateLimit(config: BotGatewayConfig, state: BotGuardState, nowMs: number): void {
  const limiter = rateLimiterForRole(state, config.role, nowMs);
  const elapsedMinutes = (nowMs - limiter.updatedAtMs) / 60000;
  limiter.tokens = Math.min(limiter.capacity, limiter.tokens + elapsedMinutes * limiter.refillPerMinute);
  limiter.updatedAtMs = nowMs;
  if (limiter.tokens >= 1) {
    limiter.tokens -= 1;
    return;
  }

  throw new BotGatewayError(429, "bot_rate_limited", "The bot write rate limit was exceeded.", 1, [
    `role=${config.role}`,
    "limit=60/min",
    "burst=10"
  ]);
}

function rateLimiterForRole(state: BotGuardState, role: BotRole, nowMs: number): RateLimiterState {
  const existing = state.rateLimiters.get(role);
  if (existing !== undefined) {
    return existing;
  }

  const created: RateLimiterState = {
    capacity: 10,
    refillPerMinute: 60,
    tokens: 10,
    updatedAtMs: nowMs
  };
  state.rateLimiters.set(role, created);
  return created;
}

function assertIdempotencyKey(input: BotToolInput, ability: BotAbility): void {
  const key = input.idempotencyKey;
  if (key !== undefined && key.trim().length > 0) {
    return;
  }

  throw new BotGatewayError(400, "idempotency_key_required", "Every bot write requires an Idempotency-Key.", null, [
    `ability=${ability.name}`
  ]);
}

function assertPayloadCap(ability: BotAbility, body: JsonObject | null): void {
  if (ability.maxRows === null) {
    return;
  }

  const largestArray = largestArrayLength(body);
  if (largestArray <= ability.maxRows) {
    return;
  }

  throw new BotGatewayError(413, "payload_too_large", "Bot writes are capped at 50 rows per call; split the work into preview-confirm chunks.", null, [
    `ability=${ability.name}`,
    `maxRows=${ability.maxRows}`,
    `largestArray=${largestArray}`
  ]);
}

function largestArrayLength(value: JsonValue | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (Array.isArray(value)) {
    const nestedLargest = value.reduce((largest: number, item: JsonValue): number => Math.max(largest, largestArrayLength(item)), value.length);
    return nestedLargest;
  }

  if (typeof value === "object") {
    return Object.values(value).reduce((largest: number, item: JsonValue): number => Math.max(largest, largestArrayLength(item)), 0);
  }

  return 0;
}

function financialLockKey(config: BotGatewayConfig, ability: BotAbility, input: BotToolInput): string | null {
  if (ability.lockScope === "none") {
    return null;
  }

  const body = input.body ?? {};
  const scope = stringField(body, "lockKey") ??
    stringField(body, "period") ??
    stringField(body, "statementId") ??
    stringField(body, "contractId") ??
    input.period ??
    ability.name;
  return `${config.workspaceId}:${ability.name}:${scope}`;
}

async function assertHealthy(config: BotGatewayConfig, state: BotGuardState): Promise<void> {
  const startedAtMs = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout((): void => controller.abort(), config.requestTimeoutMs);
    const response = await fetch(new URL("/healthz", withTrailingSlash(config.apiBaseUrl)), {
      signal: controller.signal
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - startedAtMs;
    if (!response.ok || latencyMs > config.healthLatencyThresholdMs) {
      openCircuit(state, `status=${response.status};latencyMs=${latencyMs}`);
      throw new BotGatewayError(503, "api_health_unhealthy", "The API health probe failed; bot writes are paused.", 5, [
        `status=${response.status}`,
        `latencyMs=${latencyMs}`
      ]);
    }
  } catch (error: unknown) {
    if (error instanceof BotGatewayError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "unknown";
    openCircuit(state, message);
    throw new BotGatewayError(503, "api_health_probe_failed", "The API health probe failed; bot writes are paused.", 5, [
      `error=${message}`
    ]);
  }
}

function openCircuit(state: BotGuardState, failure: string): void {
  state.circuitBreaker.pausedUntilMs = Date.now() + 30000;
  state.circuitBreaker.lastFailure = failure;
}

function shouldRetryResponse(response: Response): boolean {
  return response.status === 423 || response.status === 429 || response.status === 503;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter !== null) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 10000);
    }
  }

  return backoffMs(attempt);
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 3000);
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, durationMs);
  });
}

function materializePath(pathTemplate: string, pathParams: JsonObject): string {
  return pathTemplate.replace(/\{([^}]+)\}/gu, (_match: string, key: string): string => {
    const value = pathParams[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BotGatewayError(400, "path_param_required", "A required path parameter is missing.", null, [
        `pathTemplate=${pathTemplate}`,
        `key=${key}`
      ]);
    }

    return encodeURIComponent(value.trim());
  });
}

function bodyWithWorkspace(body: JsonObject | null, workspaceId: string): JsonObject | null {
  if (body === null) {
    return { workspaceId };
  }

  return {
    ...body,
    workspaceId
  };
}

function stringField(body: JsonObject, key: string): string | null {
  const value = body[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function withTrailingSlash(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/`;
}
