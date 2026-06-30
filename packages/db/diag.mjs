import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL;
const hasUrl = connectionString !== undefined && connectionString.length > 0;
const hasPgVars = process.env.PGHOST !== undefined && process.env.PGPASSWORD !== undefined;

if (!hasUrl && !hasPgVars) {
  console.error("ERROR: set DATABASE_URL or the PGHOST/PGUSER/PGPASSWORD/... env vars before running.");
  process.exit(1);
}

// When no DATABASE_URL is given, pg reads PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// from the environment directly — the password is sent verbatim, with no URL parsing.
const client = hasUrl
  ? new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Client({ ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("CONNECT: OK");

  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log(`PUBLIC TABLES (${tables.rowCount}): ${tables.rows.map((r) => r.table_name).join(", ") || "(none)"}`);

  const enums = await client.query(
    "select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' order by t.typname"
  );
  console.log(`ENUM TYPES (${enums.rowCount}): ${enums.rows.map((r) => r.typname).join(", ") || "(none)"}`);

  try {
    const journal = await client.query(
      "select count(*)::int as applied, max(created_at) as last_applied from drizzle.__drizzle_migrations"
    );
    console.log(`DRIZZLE JOURNAL: applied=${journal.rows[0].applied} last=${journal.rows[0].last_applied}`);
  } catch (journalError) {
    console.log(`DRIZZLE JOURNAL: missing (${journalError.code ?? journalError.message})`);
  }

  await client.end();
  console.log("DONE");
} catch (error) {
  console.error(`ERROR: ${error.message} ${error.code ?? ""}`);
  process.exit(1);
}
