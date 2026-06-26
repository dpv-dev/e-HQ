#!/usr/bin/env node
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { abilitiesForRole, findAbilityForRole, type BotAbility } from "./abilities.js";
import {
  BotGatewayError,
  buildRequestPlan,
  createBotGuardState,
  fetchWithBoundedRetry,
  parseBotRole,
  parseOptionalEnv,
  parsePositiveInteger,
  parseRequiredEnv,
  validateBotWriteEnvelope,
  withBotWriteGuards,
  type BotGatewayConfig,
  type BotGuardState,
  type BotToolInput,
  type JsonObject,
  type JsonValue
} from "./guardrails.js";

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: JsonObject;
}

interface JsonRpcSuccess {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result: JsonObject;
}

interface JsonRpcFailure {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data: JsonObject;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

const state = createBotGuardState();
const config = createConfig(process.env);

void runMcpServer(config, state);

async function runMcpServer(gatewayConfig: BotGatewayConfig, guardState: BotGuardState): Promise<void> {
  const lines = createInterface({
    input: stdin,
    crlfDelay: Infinity
  });

  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    const response = await handleJsonRpcLine(gatewayConfig, guardState, line);
    if (response !== null) {
      stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}

async function handleJsonRpcLine(gatewayConfig: BotGatewayConfig, guardState: BotGuardState, line: string): Promise<JsonRpcResponse | null> {
  let request: JsonRpcRequest;
  try {
    request = parseJsonRpcRequest(line);
  } catch (error: unknown) {
    return failure(null, -32700, "Invalid JSON-RPC request.", errorData(error));
  }

  try {
    return await handleJsonRpcRequest(gatewayConfig, guardState, request);
  } catch (error: unknown) {
    if (error instanceof BotGatewayError) {
      return failure(request.id ?? null, error.status, error.message, {
        code: error.code,
        retryAfterSeconds: error.retryAfterSeconds,
        context: error.context as readonly JsonValue[]
      });
    }

    return failure(request.id ?? null, -32603, "Bots Bureau failed while handling the request.", errorData(error));
  }
}

async function handleJsonRpcRequest(gatewayConfig: BotGatewayConfig, guardState: BotGuardState, request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  if (request.method === "notifications/initialized") {
    return null;
  }

  if (request.method === "initialize") {
    return success(request.id ?? null, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "@ehq/bots-bureau",
        version: "0.0.0"
      },
      capabilities: {
        tools: {}
      }
    });
  }

  if (request.method === "tools/list") {
    return success(request.id ?? null, {
      tools: abilitiesForRole(gatewayConfig.role).map(toolDescriptor)
    });
  }

  if (request.method === "tools/call") {
    const result = await callTool(gatewayConfig, guardState, request.params ?? {});
    return success(request.id ?? null, result);
  }

  return failure(request.id ?? null, -32601, "Unknown JSON-RPC method.", {
    method: request.method
  });
}

async function callTool(gatewayConfig: BotGatewayConfig, guardState: BotGuardState, params: JsonObject): Promise<JsonObject> {
  const abilityName = stringParam(params, "name");
  const ability = findAbilityForRole(gatewayConfig.role, abilityName);
  if (ability === null) {
    throw new BotGatewayError(403, "ability_denied", "This bot role cannot call the requested ability.", null, [
      `role=${gatewayConfig.role}`,
      `ability=${abilityName}`
    ]);
  }

  const input = botToolInputFromParams(params);
  if (input.dryRun === true) {
    validateBotWriteEnvelope(ability, input);
    return dryRunResult(gatewayConfig, ability, input);
  }

  return withBotWriteGuards(gatewayConfig, guardState, ability, input, async (): Promise<JsonObject> => {
    const request = buildRequestPlan(gatewayConfig, ability, input);
    const response = await fetchWithBoundedRetry(gatewayConfig, request);
    const responseBody = await readResponseBody(response);
    if (!response.ok) {
      throw new BotGatewayError(response.status, "api_request_failed", "The Hono API rejected the bot ability call.", retryAfterFromResponse(response), [
        `ability=${ability.name}`,
        `method=${ability.method}`,
        `path=${request.url.pathname}`,
        `status=${response.status}`,
        `body=${JSON.stringify(responseBody)}`
      ]);
    }

    return {
      ability: ability.name,
      status: response.status,
      endpoint: `${ability.method} ${request.url.pathname}`,
      body: responseBody
    };
  });
}

function createConfig(env: NodeJS.ProcessEnv): BotGatewayConfig {
  const apiBaseUrl = parseOptionalEnv(env, "EHQ_API_BASE_URL", "http://127.0.0.1:8787");
  const role = parseBotRole(env["EHQ_BOT_ROLE"]);
  return {
    apiBaseUrl,
    token: parseRequiredEnv(env, "EHQ_BOT_TOKEN"),
    role,
    workspaceId: parseOptionalEnv(env, "EHQ_BOT_WORKSPACE_ID", "eeee-mu"),
    healthLatencyThresholdMs: parsePositiveInteger(parseOptionalEnv(env, "EHQ_BOT_HEALTH_LATENCY_MS", "2500"), "EHQ_BOT_HEALTH_LATENCY_MS"),
    requestTimeoutMs: parsePositiveInteger(parseOptionalEnv(env, "EHQ_BOT_REQUEST_TIMEOUT_MS", "10000"), "EHQ_BOT_REQUEST_TIMEOUT_MS"),
    retryCount: parsePositiveInteger(parseOptionalEnv(env, "EHQ_BOT_RETRY_COUNT", "3"), "EHQ_BOT_RETRY_COUNT")
  };
}

function parseJsonRpcRequest(line: string): JsonRpcRequest {
  const parsed = JSON.parse(line) as unknown;
  if (!isJsonObject(parsed)) {
    throw new Error("JSON-RPC payload must be an object.");
  }

  const method = parsed["method"];
  if (typeof method !== "string" || method.trim().length === 0) {
    throw new Error("JSON-RPC method is required.");
  }

  const id = parsed["id"];
  const params = parsed["params"];
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: typeof id === "string" || typeof id === "number" || id === null ? id : null,
    method: method.trim()
  };
  return isJsonObject(params) ? { ...request, params } : request;
}

function toolDescriptor(ability: BotAbility): JsonObject {
  return {
    name: ability.name,
    title: ability.title,
    description: ability.description,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceId: { type: "string" },
        period: { type: "string" },
        query: { type: "object" },
        pathParams: { type: "object" },
        body: { type: "object" },
        idempotencyKey: { type: "string" },
        dryRun: { type: "boolean" }
      }
    }
  };
}

function botToolInputFromParams(params: JsonObject): BotToolInput {
  const argumentsValue = params["arguments"];
  const argumentsObject = isJsonObject(argumentsValue) ? argumentsValue : {};
  const input: Record<string, string | boolean | JsonObject> = {};
  setOptional(input, "workspaceId", optionalString(argumentsObject, "workspaceId"));
  setOptional(input, "period", optionalString(argumentsObject, "period"));
  setOptional(input, "query", optionalObject(argumentsObject, "query"));
  setOptional(input, "pathParams", optionalObject(argumentsObject, "pathParams"));
  setOptional(input, "body", optionalObject(argumentsObject, "body"));
  setOptional(input, "idempotencyKey", optionalString(argumentsObject, "idempotencyKey"));
  setOptional(input, "dryRun", optionalBoolean(argumentsObject, "dryRun"));
  return input as BotToolInput;
}

function dryRunResult(gatewayConfig: BotGatewayConfig, ability: BotAbility, input: BotToolInput): JsonObject {
  const request = buildRequestPlan(gatewayConfig, ability, input);
  return {
    dryRun: true,
    ability: ability.name,
    role: gatewayConfig.role,
    endpoint: `${ability.method} ${request.url.pathname}`,
    url: request.url.toString(),
    body: request.body,
    note: "Dry-run validates the Bots Bureau route envelope and guard metadata without forwarding a mutation to the API."
  };
}

async function readResponseBody(response: Response): Promise<JsonValue> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch (_error: unknown) {
    return text;
  }
}

function retryAfterFromResponse(response: Response): number | null {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter === null) {
    return null;
  }

  const parsed = Number.parseInt(retryAfter, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function success(id: string | number | null, result: JsonObject): JsonRpcSuccess {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function failure(id: string | number | null, code: number, message: string, data: JsonObject): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data
    }
  };
}

function errorData(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      message: error.message
    };
  }

  return {
    message: "Unknown error"
  };
}

function stringParam(params: JsonObject, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BotGatewayError(400, "tool_param_required", "A required tool parameter is missing.", null, [
      `key=${key}`
    ]);
  }

  return value.trim();
}

function optionalString(params: JsonObject, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function optionalBoolean(params: JsonObject, key: string): boolean | undefined {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}

function optionalObject(params: JsonObject, key: string): JsonObject | undefined {
  const value = params[key];
  return isJsonObject(value) ? value : undefined;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setOptional(target: Record<string, string | boolean | JsonObject>, key: string, value: string | boolean | JsonObject | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
