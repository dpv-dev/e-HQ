import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const packageDir: string = dirname(fileURLToPath(import.meta.url));

loadEnvFile(resolve(packageDir, "../../.env"));
loadEnvFile(resolve(packageDir, ".env"));

const databaseUrl: string | undefined = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error(
    "DATABASE_URL is required for @ehq/db migrate. Put the direct Supabase port 5432 connection string in the untracked root .env or export it for this shell."
  );
}

export default defineConfig({
  dialect: "postgresql",
  out: "./migrations",
  schema: ["./src/office/schema.ts", "./src/distribution/schema.ts"],
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const lines: readonly string[] = readFileSync(filePath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const parsed: EnvEntry | null = parseEnvLine(line);
    if (parsed === null || process.env[parsed.key] !== undefined) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
}

interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

function parseEnvLine(line: string): EnvEntry | null {
  const trimmed: string = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const match: RegExpExecArray | null = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(trimmed);
  if (match === null) {
    return null;
  }

  const key: string = match[1] ?? "";
  const rawValue: string = match[2] ?? "";
  return {
    key,
    value: unquoteEnvValue(rawValue.trim())
  };
}

function unquoteEnvValue(value: string): string {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1).replaceAll("\\\"", "\"");
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}
