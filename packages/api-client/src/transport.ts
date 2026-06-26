import {
  ApiClientConfigurationError,
  ApiClientDecodeError,
  ApiClientHttpError,
  ApiClientNetworkError
} from "./errors.js";
import type {
  ApiClientConfig,
  HttpMethod,
  IdempotencyKey,
  LegacyNamespace,
  RetryPolicy
} from "./types.js";

type QueryValue = string | number | boolean | null | readonly string[];
type QueryParams = Readonly<Record<string, QueryValue>>;

interface RequestInput {
  readonly method: HttpMethod;
  readonly namespace: LegacyNamespace;
  readonly path: string;
  readonly query: QueryParams;
  readonly body: unknown | null;
  readonly idempotencyKey: IdempotencyKey | null;
}

export interface RestTransport {
  readonly get: <TResult>(path: string, query: QueryParams) => Promise<TResult>;
  readonly post: <TResult>(path: string, body: unknown, idempotencyKey: IdempotencyKey) => Promise<TResult>;
  readonly patch: <TResult>(path: string, body: unknown, idempotencyKey: IdempotencyKey) => Promise<TResult>;
}

export const standardApiRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 150,
  maxRetryAfterMs: 8_000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryMethods: ["GET"]
};

export function createRestTransport(config: ApiClientConfig, namespace: LegacyNamespace): RestTransport {
  validateConfig(config);

  return {
    get: <TResult>(path: string, query: QueryParams): Promise<TResult> =>
      requestJson<TResult>(config, {
        method: "GET",
        namespace,
        path,
        query,
        body: null,
        idempotencyKey: null
      }),
    post: <TResult>(path: string, body: unknown, idempotencyKey: IdempotencyKey): Promise<TResult> =>
      requestJson<TResult>(config, {
        method: "POST",
        namespace,
        path,
        query: {},
        body,
        idempotencyKey
      }),
    patch: <TResult>(path: string, body: unknown, idempotencyKey: IdempotencyKey): Promise<TResult> =>
      requestJson<TResult>(config, {
        method: "PATCH",
        namespace,
        path,
        query: {},
        body,
        idempotencyKey
      })
  };
}

export function encodePathSegment(segment: string): string {
  if (segment.length === 0) {
    throw new ApiClientConfigurationError({
      message: "Cannot encode an empty REST path segment.",
      context: ["pathSegment="]
    });
  }

  return encodeURIComponent(segment);
}

async function requestJson<TResult>(config: ApiClientConfig, input: RequestInput): Promise<TResult> {
  validateRequestInput(input);

  const url = buildUrl(config.baseUrl, input.namespace, input.path, input.query);
  const headers = await buildHeaders(config, input);
  const init = buildRequestInit(input, headers);
  const maxAttempts = config.retryPolicy.maxAttempts;

  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      const response = await config.fetch(url, init);
      const responseBody = await response.text();

      if (!response.ok) {
        const requestId = response.headers.get("x-request-id");
        const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
        const error = new ApiClientHttpError({
          method: input.method,
          url,
          status: response.status,
          statusText: response.statusText,
          responseBody,
          requestId,
          retryAfterMs
        });

        if (attempt < maxAttempts && shouldRetryStatus(input.method, response.status, config.retryPolicy)) {
          await sleep(calculateRetryDelayMs(config.retryPolicy, attempt, response.status, retryAfterMs));
          attempt += 1;
          continue;
        }

        throw error;
      }

      return parseJson<TResult>(input.method, url, responseBody);
    } catch (error: unknown) {
      if (isApiClientHttpError(error) || isApiClientDecodeError(error) || isApiClientConfigurationError(error)) {
        throw error;
      }

      if (attempt < maxAttempts && shouldRetryNetworkError(input.method, config.retryPolicy)) {
        await sleep(calculateRetryDelayMs(config.retryPolicy, attempt, null, null));
        attempt += 1;
        continue;
      }

      throw new ApiClientNetworkError({
        method: input.method,
        url,
        cause: error
      });
    }
  }

  throw new ApiClientConfigurationError({
    message: "Retry loop finished without returning or throwing.",
    context: [`method=${input.method}`, `path=${input.path}`, `maxAttempts=${String(maxAttempts)}`]
  });
}

async function buildHeaders(config: ApiClientConfig, input: RequestInput): Promise<Headers> {
  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (input.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  if (input.idempotencyKey !== null) {
    headers.set("Idempotency-Key", input.idempotencyKey);
  }

  const accessToken = await config.auth.getAccessToken();
  if (accessToken !== null) {
    if (accessToken.trim().length === 0) {
      throw new ApiClientConfigurationError({
        message: "Auth token provider returned an empty token.",
        context: [`namespace=${input.namespace}`, `path=${input.path}`]
      });
    }

    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

function buildRequestInit(input: RequestInput, headers: Headers): RequestInit {
  const init: RequestInit = {
    method: input.method,
    headers
  };

  if (input.body !== null) {
    init.body = JSON.stringify(input.body);
  }

  return init;
}

function buildUrl(baseUrl: string, namespace: LegacyNamespace, path: string, query: QueryParams): string {
  const trimmedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = trimSlashes(path);
  const search = buildQueryString(query);
  const url = `${trimmedBase}/${namespace}/${normalizedPath}`;

  if (search.length === 0) {
    return url;
  }

  return `${url}?${search}`;
}

function buildQueryString(query: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
      continue;
    }

    search.set(key, String(value));
  }

  return search.toString();
}

function parseJson<TResult>(method: HttpMethod, url: string, responseBody: string): TResult {
  if (responseBody.length === 0) {
    return null as TResult;
  }

  try {
    return JSON.parse(responseBody) as TResult;
  } catch (error: unknown) {
    throw new ApiClientDecodeError({
      method,
      url,
      responseBody,
      cause: error
    });
  }
}

function trimTrailingSlash(value: string): string {
  if (value.trim().length === 0) {
    throw new ApiClientConfigurationError({
      message: "API baseUrl must not be empty.",
      context: ["baseUrl="]
    });
  }

  return value.replace(/\/+$/u, "");
}

function trimSlashes(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/gu, "");
  if (trimmed.length === 0) {
    throw new ApiClientConfigurationError({
      message: "REST path must not be empty.",
      context: [`path=${value}`]
    });
  }

  return trimmed;
}

function validateConfig(config: ApiClientConfig): void {
  if (config.baseUrl.trim().length === 0) {
    throw new ApiClientConfigurationError({
      message: "API client baseUrl is required.",
      context: ["field=baseUrl"]
    });
  }

  if (config.retryPolicy.maxAttempts < 1 || config.retryPolicy.maxAttempts > 5) {
    throw new ApiClientConfigurationError({
      message: "Retry maxAttempts must be between 1 and 5.",
      context: [`maxAttempts=${String(config.retryPolicy.maxAttempts)}`]
    });
  }

  if (config.retryPolicy.baseDelayMs < 0 || config.retryPolicy.baseDelayMs > 5_000) {
    throw new ApiClientConfigurationError({
      message: "Retry baseDelayMs must be between 0 and 5000.",
      context: [`baseDelayMs=${String(config.retryPolicy.baseDelayMs)}`]
    });
  }

  if (config.retryPolicy.maxRetryAfterMs < 0 || config.retryPolicy.maxRetryAfterMs > 60_000) {
    throw new ApiClientConfigurationError({
      message: "Retry maxRetryAfterMs must be between 0 and 60000.",
      context: [`maxRetryAfterMs=${String(config.retryPolicy.maxRetryAfterMs)}`]
    });
  }

  for (const method of config.retryPolicy.retryMethods) {
    if (method !== "GET" && method !== "POST" && method !== "PATCH") {
      throw new ApiClientConfigurationError({
        message: "Retry method is not supported.",
        context: [`method=${method}`]
      });
    }
  }
}

function validateRequestInput(input: RequestInput): void {
  if ((input.method === "POST" || input.method === "PATCH") && input.idempotencyKey === null) {
    throw new ApiClientConfigurationError({
      message: "Write requests require an Idempotency-Key.",
      context: [`method=${input.method}`, `path=${input.path}`]
    });
  }

  if (input.idempotencyKey !== null && input.idempotencyKey.trim().length === 0) {
    throw new ApiClientConfigurationError({
      message: "Idempotency-Key must not be empty.",
      context: [`method=${input.method}`, `path=${input.path}`]
    });
  }
}

function shouldRetryStatus(method: HttpMethod, status: number, retryPolicy: RetryPolicy): boolean {
  return retryPolicy.retryMethods.includes(method) && retryPolicy.retryableStatuses.includes(status);
}

function shouldRetryNetworkError(method: HttpMethod, retryPolicy: RetryPolicy): boolean {
  return retryPolicy.retryMethods.includes(method);
}

function calculateRetryDelayMs(
  retryPolicy: RetryPolicy,
  attempt: number,
  status: number | null,
  retryAfterMs: number | null
): number {
  const linearBackoffMs = retryPolicy.baseDelayMs * attempt;

  if (status !== 429 && status !== 503) {
    return linearBackoffMs;
  }

  if (retryAfterMs === null) {
    return linearBackoffMs;
  }

  const boundedRetryAfterMs = Math.min(retryPolicy.maxRetryAfterMs, retryAfterMs);

  return Math.max(linearBackoffMs, boundedRetryAfterMs);
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (headerValue === null) {
    return null;
  }

  const trimmed = headerValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isSafeInteger(seconds)) {
      return null;
    }

    const milliseconds = seconds * 1_000;
    if (!Number.isSafeInteger(milliseconds)) {
      return null;
    }

    return milliseconds;
  }

  const retryAtEpochMs = Date.parse(trimmed);
  if (Number.isNaN(retryAtEpochMs)) {
    return null;
  }

  return Math.max(0, retryAtEpochMs - Date.now());
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, delayMs);
  });
}

function isApiClientHttpError(error: unknown): error is ApiClientHttpError {
  return error instanceof ApiClientHttpError;
}

function isApiClientDecodeError(error: unknown): error is ApiClientDecodeError {
  return error instanceof ApiClientDecodeError;
}

function isApiClientConfigurationError(error: unknown): error is ApiClientConfigurationError {
  return error instanceof ApiClientConfigurationError;
}
