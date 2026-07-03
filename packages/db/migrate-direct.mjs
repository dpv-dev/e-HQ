import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");

loadEnvFile(resolve(repoRoot, ".env"));

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL is required in the untracked root .env before running migrate:direct.");
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrl(databaseUrl)
});

try {
  const db = drizzle(pool);
  await migrate(db, {
    migrationsFolder: resolve(packageDir, "migrations")
  });

  const result = await pool.query(
    "select count(*)::int as applied, max(created_at) as last_applied from drizzle.__drizzle_migrations"
  );
  const row = result.rows[0] ?? { applied: 0, last_applied: null };
  console.log(`MIGRATE_DIRECT: OK applied=${row.applied} last=${row.last_applied}`);
} finally {
  await pool.end();
}

function normalizeDatabaseUrl(value) {
  if (value.includes("sslmode=")) {
    return value.replace(/sslmode=[^&]*/u, "sslmode=no-verify");
  }

  return `${value}${value.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const entry = parseEnvLine(line);
    if (entry === null || process.env[entry.key] !== undefined) {
      continue;
    }

    process.env[entry.key] = entry.value;
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(trimmed);
  if (match === null) {
    return null;
  }

  const key = match[1] ?? "";
  const rawValue = match[2] ?? "";
  return {
    key,
    value: unquoteEnvValue(rawValue.trim())
  };
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1).replaceAll("\\\"", "\"");
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}
