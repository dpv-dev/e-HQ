import type { HttpMethod } from "./types.js";

export interface ApiClientHttpErrorInput {
  readonly method: HttpMethod;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: string;
  readonly requestId: string | null;
  readonly retryAfterMs: number | null;
}

export interface ApiClientNetworkErrorInput {
  readonly method: HttpMethod;
  readonly url: string;
  readonly cause: unknown;
}

export interface ApiClientDecodeErrorInput {
  readonly method: HttpMethod;
  readonly url: string;
  readonly responseBody: string;
  readonly cause: unknown;
}

export interface ApiClientConfigurationErrorInput {
  readonly message: string;
  readonly context: readonly string[];
}

export class ApiClientHttpError extends Error {
  readonly code = "api_client_http_error";
  readonly method: HttpMethod;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: string;
  readonly requestId: string | null;
  readonly retryAfterMs: number | null;

  constructor(input: ApiClientHttpErrorInput) {
    super(
      `API request failed: method=${input.method} url=${input.url} status=${input.status} requestId=${input.requestId ?? "missing"}`
    );
    this.name = "ApiClientHttpError";
    this.method = input.method;
    this.url = input.url;
    this.status = input.status;
    this.statusText = input.statusText;
    this.responseBody = input.responseBody;
    this.requestId = input.requestId;
    this.retryAfterMs = input.retryAfterMs;
  }
}

export class ApiClientNetworkError extends Error {
  readonly code = "api_client_network_error";
  readonly method: HttpMethod;
  readonly url: string;
  override readonly cause: unknown;

  constructor(input: ApiClientNetworkErrorInput) {
    super(`API request could not reach the server: method=${input.method} url=${input.url}`);
    this.name = "ApiClientNetworkError";
    this.method = input.method;
    this.url = input.url;
    this.cause = input.cause;
  }
}

export class ApiClientDecodeError extends Error {
  readonly code = "api_client_decode_error";
  readonly method: HttpMethod;
  readonly url: string;
  readonly responseBody: string;
  override readonly cause: unknown;

  constructor(input: ApiClientDecodeErrorInput) {
    super(`API response was not valid JSON: method=${input.method} url=${input.url}`);
    this.name = "ApiClientDecodeError";
    this.method = input.method;
    this.url = input.url;
    this.responseBody = input.responseBody;
    this.cause = input.cause;
  }
}

export class ApiClientConfigurationError extends Error {
  readonly code = "api_client_configuration_error";
  readonly context: readonly string[];

  constructor(input: ApiClientConfigurationErrorInput) {
    super(input.message);
    this.name = "ApiClientConfigurationError";
    this.context = input.context;
  }
}
