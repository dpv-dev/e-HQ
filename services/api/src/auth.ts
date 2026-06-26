import type { AuthMetadata, AuthRoleId } from "@ehq/auth";
import { getAuthRoleFromMetadata } from "@ehq/auth";
import type { MiddlewareHandler } from "hono";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload
} from "jose";

export interface AuthenticatedApiUser {
  readonly userId: string;
  readonly email: string | null;
  readonly role: AuthRoleId;
  readonly workspaceId: string | null;
}

export interface ApiAuthBindings {
  Variables: {
    authUser: AuthenticatedApiUser;
  };
}

export interface SupabaseJwtAuthConfig {
  readonly jwtSecret: string | null;
  readonly supabaseUrl: string | null;
}

export interface SupabaseJwtVerifier {
  readonly verify: (token: string) => Promise<AuthenticatedApiUser>;
}

interface AuthErrorInput {
  readonly message: string;
  readonly context: readonly string[];
}

type SupabaseRemoteJwkSet = ReturnType<typeof createRemoteJWKSet>;

const asymmetricAlgorithms: readonly string[] = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];

export class AuthConfigurationError extends Error {
  readonly context: readonly string[];

  constructor(input: AuthErrorInput) {
    super(input.message);
    this.name = "AuthConfigurationError";
    this.context = input.context;
  }
}

export class AuthVerificationError extends Error {
  readonly context: readonly string[];

  constructor(input: AuthErrorInput) {
    super(input.message);
    this.name = "AuthVerificationError";
    this.context = input.context;
  }
}

export function createSupabaseJwtAuthConfig(env: Readonly<Record<string, string | undefined>>): SupabaseJwtAuthConfig {
  return {
    jwtSecret: nullableEnv(env, "SUPABASE_JWT_SECRET"),
    supabaseUrl: nullableEnv(env, "SUPABASE_URL")
  };
}

export function createSupabaseJwtVerifier(config: SupabaseJwtAuthConfig): SupabaseJwtVerifier {
  const remoteJwkSet = config.supabaseUrl === null ? null : createRemoteJWKSet(supabaseJwksUrl(config.supabaseUrl));

  return {
    verify: (token: string): Promise<AuthenticatedApiUser> =>
      verifySupabaseJwt(token, config, remoteJwkSet)
  };
}

export function createSupabaseAuthMiddleware(verifier: SupabaseJwtVerifier): MiddlewareHandler<ApiAuthBindings> {
  return async (context, next): Promise<Response | void> => {
    try {
      const token = bearerTokenFromHeader(context.req.header("Authorization") ?? null);
      const authUser = await verifier.verify(token);
      context.set("authUser", authUser);
      await next();
      return undefined;
    } catch (_error: unknown) {
      return context.json({ error: "unauthorized" }, 401);
    }
  };
}

async function verifySupabaseJwt(
  token: string,
  config: SupabaseJwtAuthConfig,
  remoteJwkSet: SupabaseRemoteJwkSet | null
): Promise<AuthenticatedApiUser> {
  const protectedHeader = decodeProtectedHeader(token);
  const algorithm = protectedHeader.alg;

  if (algorithm === undefined) {
    throw new AuthVerificationError({
      message: "Supabase JWT header is missing alg.",
      context: ["header.alg=undefined"]
    });
  }

  if (algorithm === "HS256") {
    return authenticatedUserFromPayload(await verifySymmetricJwt(token, config));
  }

  if (isAsymmetricAlgorithm(algorithm)) {
    return authenticatedUserFromPayload(await verifyAsymmetricJwt(token, remoteJwkSet, algorithm));
  }

  throw new AuthVerificationError({
    message: "Supabase JWT uses an unsupported signing algorithm.",
    context: [`alg=${algorithm}`]
  });
}

async function verifySymmetricJwt(token: string, config: SupabaseJwtAuthConfig): Promise<JWTPayload> {
  if (config.jwtSecret === null) {
    throw new AuthConfigurationError({
      message: "SUPABASE_JWT_SECRET is required for HS256 Supabase JWT verification.",
      context: ["env=SUPABASE_JWT_SECRET"]
    });
  }

  const secret = new TextEncoder().encode(config.jwtSecret);
  const result = await jwtVerify(token, secret);
  return result.payload;
}

async function verifyAsymmetricJwt(
  token: string,
  remoteJwkSet: SupabaseRemoteJwkSet | null,
  algorithm: string
): Promise<JWTPayload> {
  if (remoteJwkSet === null) {
    throw new AuthConfigurationError({
      message: "SUPABASE_URL is required for asymmetric Supabase JWT verification.",
      context: [`alg=${algorithm}`, "env=SUPABASE_URL"]
    });
  }

  const result = await jwtVerify(token, remoteJwkSet);
  return result.payload;
}

function authenticatedUserFromPayload(payload: JWTPayload): AuthenticatedApiUser {
  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new AuthVerificationError({
      message: "Supabase JWT payload is missing sub.",
      context: ["claim=sub"]
    });
  }

  const appMetadata = metadataFromClaim(payload["app_metadata"]);
  const userMetadata = metadataFromClaim(payload["user_metadata"]);

  return {
    userId: payload.sub,
    email: stringClaim(payload["email"]),
    role: getAuthRoleFromMetadata(appMetadata, userMetadata),
    workspaceId: workspaceIdFromMetadata(appMetadata, userMetadata)
  };
}

function bearerTokenFromHeader(authorizationHeader: string | null): string {
  if (authorizationHeader === null) {
    throw new AuthVerificationError({
      message: "Authorization header is missing.",
      context: ["header=Authorization"]
    });
  }

  const parts = authorizationHeader.trim().split(/\s+/u);
  if (parts.length !== 2 || parts[0] !== "Bearer" || parts[1] === undefined || parts[1].trim().length === 0) {
    throw new AuthVerificationError({
      message: "Authorization header must use Bearer token syntax.",
      context: [`authorization=${authorizationHeader}`]
    });
  }

  return parts[1];
}

function metadataFromClaim(value: unknown): AuthMetadata {
  if (!isRecord(value)) {
    return {};
  }

  return value;
}

function stringClaim(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function workspaceIdFromMetadata(appMetadata: AuthMetadata, userMetadata: AuthMetadata): string | null {
  return stringFromMetadata(appMetadata, "workspaceId") ??
    stringFromMetadata(userMetadata, "workspaceId") ??
    stringFromMetadata(appMetadata, "workspace_id") ??
    stringFromMetadata(userMetadata, "workspace_id") ??
    stringFromMetadata(appMetadata, "ehq_workspace_id") ??
    stringFromMetadata(userMetadata, "ehq_workspace_id");
}

function stringFromMetadata(metadata: AuthMetadata, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function isRecord(value: unknown): value is AuthMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAsymmetricAlgorithm(algorithm: string): boolean {
  return asymmetricAlgorithms.includes(algorithm);
}

function supabaseJwksUrl(supabaseUrl: string): URL {
  const trimmedUrl = supabaseUrl.trim();
  if (trimmedUrl.length === 0) {
    throw new AuthConfigurationError({
      message: "SUPABASE_URL must not be empty when asymmetric JWT verification is enabled.",
      context: ["env=SUPABASE_URL"]
    });
  }

  return new URL("/auth/v1/.well-known/jwks.json", `${trimmedUrl.replace(/\/+$/u, "")}/`);
}

function nullableEnv(env: Readonly<Record<string, string | undefined>>, key: string): string | null {
  const value = env[key];
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
