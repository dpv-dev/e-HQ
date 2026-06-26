#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  createOfficeB2LoadRequest,
  formatOfficeB2LoadReport,
  formatOfficeB2PgliteValidationReport,
  formatOfficeB2PostgresLoadReport,
  formatOfficeB2PostgresVerifyReport,
  officeB2CliFlagError,
  runOfficeB2LoadFromSql,
  runOfficeB2PgliteValidationFromSql,
  runOfficeB2PostgresLoadFromSql,
  runOfficeB2PostgresVerifyOnly,
  loadDefaultEnvFiles,
  serializeOfficeB2PgliteValidationReport,
  serializeOfficeB2PostgresLoadReport,
  serializeOfficeB2PostgresVerifyReport,
  serializeOfficeB2LoadReport
} from "../src/index.ts";

loadDefaultEnvFiles();
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const parsedArgs = parseArgs(process.argv.slice(2));
const outputDirArg = parsedArgs.positionals.at(-1);
const dumpPathArg = parsedArgs.verifyOnly && parsedArgs.positionals.length === 1 ? undefined : parsedArgs.positionals[0];
const flagError = officeB2CliFlagError(parsedArgs.target, parsedArgs.reset, parsedArgs.verifyOnly);

if ((!parsedArgs.verifyOnly && dumpPathArg === undefined) || outputDirArg === undefined || (parsedArgs.verifyOnly && parsedArgs.positionals.length > 2)) {
  console.error("Usage: pnpm --filter @ehq/migration-tools office:b2-load -- [<dump.sql>] <output-dir> [--target parity|pglite|postgres] [--force] [--reset] [--verify-only]");
  process.exitCode = 1;
} else if (flagError !== null) {
  console.error(flagError);
  process.exitCode = 1;
} else if (parsedArgs.target === "postgres" && (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim().length === 0)) {
  console.error("DATABASE_URL is required for --target postgres. Use the direct Supabase port 5432 URL in a local untracked .env.");
  process.exitCode = 1;
} else {
  const invocationCwd = process.env.INIT_CWD ?? process.cwd();
  const outputDir = resolveArgPath(outputDirArg, invocationCwd);
  const dumpPath = dumpPathArg === undefined ? null : resolveArgPath(dumpPathArg, invocationCwd);
  if (dumpPath !== null) {
    const dumpStat = await requireFile(dumpPath, "dump");
    progress(`→ reading dump: ${dumpPath} (${formatBytes(dumpStat.size)})`);
  } else {
    progress("→ verify-only lite mode: dump omitted");
  }

  progress(`→ report dir: ${outputDir}`);
  const request = createOfficeB2LoadRequest(new Date().toISOString(), dumpPath ?? "postgres verify-only lite");
  await mkdir(outputDir, { recursive: true });

  if (parsedArgs.verifyOnly) {
    const verifySql = dumpPath === null ? null : await readFile(dumpPath, "utf8");
    const report = await runOfficeB2PostgresVerifyOnly(request, {
      env: process.env,
      progress,
      mode: dumpPath === null ? "lite" : "full",
      sql: verifySql
    });
    await writeFile(resolve(outputDir, "office-b2-postgres-verify.json"), serializeOfficeB2PostgresVerifyReport(report), "utf8");
    await writeFile(resolve(outputDir, "office-b2-postgres-verify.md"), formatOfficeB2PostgresVerifyReport(report), "utf8");
    console.log(formatOfficeB2PostgresVerifyReport(report));
    if (report.status !== "pass") {
      process.exitCode = 1;
    }
  } else if (dumpPath === null) {
    throw new Error("dump path is required unless --verify-only is passed.");
  } else {
    const sql = await readFile(dumpPath, "utf8");
    if (parsedArgs.target === "parity") {
    const report = runOfficeB2LoadFromSql(sql, request);
    await writeFile(resolve(outputDir, "office-b2-parity.json"), serializeOfficeB2LoadReport(report), "utf8");
    await writeFile(resolve(outputDir, "office-b2-parity.md"), formatOfficeB2LoadReport(report), "utf8");
    console.log(formatOfficeB2LoadReport(report));
    } else if (parsedArgs.target === "pglite") {
    const report = await runOfficeB2PgliteValidationFromSql(sql, request);
    await writeFile(resolve(outputDir, "office-b2-pglite.json"), serializeOfficeB2PgliteValidationReport(report), "utf8");
    await writeFile(resolve(outputDir, "office-b2-pglite.md"), formatOfficeB2PgliteValidationReport(report), "utf8");
    console.log(formatOfficeB2PgliteValidationReport(report));
    } else {
    const report = await runOfficeB2PostgresLoadFromSql(sql, request, { force: parsedArgs.force, reset: parsedArgs.reset, env: process.env, progress });
    await writeFile(resolve(outputDir, "office-b2-postgres.json"), serializeOfficeB2PostgresLoadReport(report), "utf8");
    await writeFile(resolve(outputDir, "office-b2-postgres.md"), formatOfficeB2PostgresLoadReport(report), "utf8");
    console.log(formatOfficeB2PostgresLoadReport(report));
    if (report.status !== "pass") {
      process.exitCode = 1;
    }
    }
  }
}

function parseArgs(args) {
  const positionals = [];
  let target = "parity";
  let force = false;
  let verifyOnly = false;
  let reset = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--reset") {
      reset = true;
    } else if (arg === "--verify-only") {
      verifyOnly = true;
    } else if (arg === "--") {
      continue;
    } else if (arg === "--target") {
      const value = args[index + 1];
      if (value !== "parity" && value !== "pglite" && value !== "postgres") {
        throw new Error("Invalid --target. Expected parity, pglite, or postgres.");
      }

      target = value;
      index += 1;
    } else if (arg.startsWith("--target=")) {
      const value = arg.slice("--target=".length);
      if (value !== "parity" && value !== "pglite" && value !== "postgres") {
        throw new Error("Invalid --target. Expected parity, pglite, or postgres.");
      }

      target = value;
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, target, force, reset, verifyOnly };
}

function resolveArgPath(pathArg, baseDir) {
  return isAbsolute(pathArg) ? pathArg : resolve(baseDir, pathArg);
}

async function requireFile(path, label) {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      throw new Error(`${label} path is not a file: ${path}`);
    }

    return fileStat;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`${label} file does not exist: ${path}`);
    }

    throw error;
  }
}

function progress(message) {
  process.stdout.write(`${message}\n`);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }

  const mib = bytes / 1024 / 1024;
  return `${mib.toFixed(1)} MiB`;
}

function fail(error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
