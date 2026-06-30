export type HqEnvKey = "VITE_API_BASE_URL" | "PUBLIC_API_BASE_URL" | "VITE_SUPABASE_URL" | "PUBLIC_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY" | "PUBLIC_SUPABASE_ANON_KEY";

const fallbackKey = (key: "VITE_API_BASE_URL" | "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string => {
  if (key === "VITE_API_BASE_URL") {
    return "PUBLIC_API_BASE_URL";
  }

  if (key === "VITE_SUPABASE_URL") {
    return "PUBLIC_SUPABASE_URL";
  }

  return "PUBLIC_SUPABASE_ANON_KEY";
};

export function readOptionalViteEnv(key: HqEnvKey): string | null {
  const value = import.meta.env[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  const alternateKey =
    key === "VITE_API_BASE_URL" || key === "VITE_SUPABASE_URL" || key === "VITE_SUPABASE_ANON_KEY"
      ? fallbackKey(key)
      : null;

  if (alternateKey !== null) {
    const alternateValue = import.meta.env[alternateKey];

    if (typeof alternateValue === "string" && alternateValue.trim().length > 0) {
      return alternateValue.trim();
    }
  }

  return null;
}

export function readRequiredViteEnv(key: HqEnvKey): string {
  const value = readOptionalViteEnv(key);

  if (value === null) {
    throw new Error(`${key} must be set for the HQ app build/runtime.`);
  }

  return value;
}
