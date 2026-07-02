import { createAuthSessionFromIdentity, type AuthMetadata, type AuthSession } from "@ehq/auth";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { readOptionalViteEnv } from "./env.js";

export interface SupabasePasswordSignInInput {
  readonly email: string;
  readonly password: string;
}

export interface SupabaseAuthSubscription {
  readonly unsubscribe: () => void;
}

interface SupabaseAuthConfig {
  readonly url: string;
  readonly anonKey: string;
}

let supabaseClient: SupabaseClient | null = null;

export async function signInWithSupabasePassword(input: SupabasePasswordSignInInput): Promise<AuthSession> {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (error !== null) {
    throw new Error(`Supabase sign-in failed: ${error.message}`);
  }

  if (data.session === null) {
    throw new Error(`Supabase sign-in returned no session for email=${input.email}.`);
  }

  return createAuthSessionFromSupabaseSession(data.session);
}

export async function sendSupabasePasswordReset(email: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`
  });

  if (error !== null) {
    throw new Error(`Supabase password reset failed for email=${email}: ${error.message}`);
  }
}

export async function restoreSupabaseAuthSession(): Promise<AuthSession | null> {
  const client = getSupabaseClient();

  if (client === null) {
    return null;
  }

  const { data, error } = await client.auth.getSession();

  if (error !== null) {
    throw new Error(`Supabase session restore failed: ${error.message}`);
  }

  if (data.session === null) {
    return null;
  }

  return createAuthSessionFromSupabaseSession(data.session);
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();

  if (client === null) {
    return null;
  }

  const { data, error } = await client.auth.getSession();

  if (error !== null) {
    throw new Error(`Supabase access token lookup failed: ${error.message}`);
  }

  return data.session?.access_token ?? null;
}

export async function signOutOfSupabase(): Promise<void> {
  const client = getSupabaseClient();

  if (client === null) {
    return;
  }

  const { error } = await client.auth.signOut();

  if (error !== null) {
    throw new Error(`Supabase sign-out failed: ${error.message}`);
  }
}

export function createAuthSessionFromSupabaseSession(session: Session): AuthSession {
  return createAuthSessionFromSupabaseUser(session.user);
}

export function subscribeToSupabaseAuthSession(
  onSessionChange: (session: AuthSession | null) => void
): SupabaseAuthSubscription {
  const client = getSupabaseClient();

  if (client === null) {
    return {
      unsubscribe: (): void => {}
    };
  }

  const authState = client.auth.onAuthStateChange((_event, nextSession): void => {
    onSessionChange(nextSession === null ? null : createAuthSessionFromSupabaseSession(nextSession));
  });

  return {
    unsubscribe: (): void => {
      authState.data.subscription.unsubscribe();
    }
  };
}

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== null) {
    return supabaseClient;
  }

  const config = readSupabaseAuthConfig();
  if (config === null) {
    return null;
  }

  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();

  if (client === null) {
    throw new Error("Supabase auth is not configured. Rebuild HQ with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return client;
}

function readSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = readOptionalViteEnv("VITE_SUPABASE_URL");
  const anonKey = readOptionalViteEnv("VITE_SUPABASE_ANON_KEY");

  if (url === null || anonKey === null) {
    return null;
  }

  return {
    url,
    anonKey
  };
}

function createAuthSessionFromSupabaseUser(user: User): AuthSession {
  return createAuthSessionFromIdentity({
    userId: user.id,
    email: user.email ?? null,
    appMetadata: metadataFromSupabase(user.app_metadata),
    userMetadata: metadataFromSupabase(user.user_metadata)
  });
}

function metadataFromSupabase(metadata: Readonly<Record<string, unknown>>): AuthMetadata {
  return metadata;
}
