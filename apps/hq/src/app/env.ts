export type HqEnvKey = "VITE_API_BASE_URL" | "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY";

export function readOptionalViteEnv(key: HqEnvKey): string | null {
  const value = import.meta.env[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

export function readRequiredViteEnv(key: HqEnvKey): string {
  const value = readOptionalViteEnv(key);

  if (value === null) {
    throw new Error(`${key} must be set for the HQ app build/runtime.`);
  }

  return value;
}
