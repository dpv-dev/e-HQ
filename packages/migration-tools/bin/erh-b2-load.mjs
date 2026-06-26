#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  createDistributionB2ErhLoadRequest,
  distributionB2ErhCliFlagError,
  formatDistributionB2ErhLoadReport,
  formatDistributionB2ErhPgliteValidationReport,
  formatDistributionB2ErhPostgresLoadReport,
  formatDistributionB2ErhPostgresVerifyReport,
  runDistributionB2ErhLoadFromDumpFile,
  runDistributionB2ErhPgliteValidationFromDumpFile,
  runDistributionB2ErhPostgresLoadFromDumpFile,
  runDistributionB2ErhPostgresVerifyOnly,
  loadDefaultEnvFiles,
  serializeDistributionB2ErhPgliteValidationReport,
  serializeDistributionB2ErhPostgresLoadReport,
  serializeDistributionB2ErhPostgresVerifyReport,
  serializeDistributionB2ErhLoadReport
} from "../src/index.ts";

loadDefaultEnvFiles();
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const parsedArgs = parseArgs(process.argv.slice(2));
const parsedPositionals = parsePositionals(parsedArgs.positionals, parsedArgs.verifyOnly);
const flagError = distributionB2ErhCliFlagError(parsedArgs.target, parsedArgs.reset, parsedArgs.verifyOnly);

if (parsedPositionals === null) {
  console.error("Usage: pnpm --filter @ehq/migration-tools erh:b2-load -- [<dump.sql> <contract.json>|<contract.json>] <output-dir> [--target parity|pglite|postgres] [--force] [--reset] [--verify-only]");
  process.exitCode = 1;
} else if (flagError !== null) {
  console.error(flagError);
  process.exitCode = 1;
} else if (parsedArgs.target === "postgres" && (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim().length === 0)) {
  console.error("DATABASE_URL is required for --target postgres. Use the direct Supabase port 5432 URL in a local untracked .env.");
  process.exitCode = 1;
} else {
  const invocationCwd = process.env.INIT_CWD ?? process.cwd();
  const dumpPath = parsedPositionals.dumpPathArg === null ? null : resolveArgPath(parsedPositionals.dumpPathArg, invocationCwd);
  const contractPath = parsedPositionals.contractPathArg === null ? defaultContractPath(invocationCwd) : resolveArgPath(parsedPositionals.contractPathArg, invocationCwd);
  const outputDir = resolveArgPath(parsedPositionals.outputDirArg, invocationCwd);
  if (dumpPath !== null) {
    const dumpStat = await requireFile(dumpPath, "dump");
    progress(`→ reading dump: ${dumpPath} (${formatBytes(dumpStat.size)})`);
  } else {
    progress("→ verify-only lite mode: dump omitted");
  }

  await requireFile(contractPath, "contract");
  progress(`→ contract: ${contractPath}`);
  progress(`→ report dir: ${outputDir}`);
  const contractJson = JSON.parse(await readFile(contractPath, "utf8"));
  const request = createDistributionB2ErhLoadRequest(new Date().toISOString(), dumpPath ?? "postgres verify-only lite", contractJson);
  await mkdir(outputDir, { recursive: true });

  if (parsedArgs.verifyOnly) {
    const report = await runDistributionB2ErhPostgresVerifyOnly(request, {
      env: process.env,
      progress,
      mode: dumpPath === null ? "lite" : "full",
      dumpFilePath: dumpPath
    });
    await writeFile(resolve(outputDir, "distribution-b2-erh-postgres-verify.json"), serializeDistributionB2ErhPostgresVerifyReport(report), "utf8");
    await writeFile(resolve(outputDir, "distribution-b2-erh-postgres-verify.md"), formatDistributionB2ErhPostgresVerifyReport(report), "utf8");
    console.log(formatDistributionB2ErhPostgresVerifyReport(report));
    if (report.status !== "pass") {
      process.exitCode = 1;
    }
  } else if (dumpPath === null) {
    throw new Error("dump path is required unless --verify-only is passed.");
  } else if (parsedArgs.target === "parity") {
    const report = await runDistributionB2ErhLoadFromDumpFile(dumpPath, request);
    await writeFile(resolve(outputDir, "distribution-b2-erh-parity.json"), serializeDistributionB2ErhLoadReport(report), "utf8");
    await writeFile(resolve(outputDir, "distribution-b2-erh-parity.md"), formatDistributionB2ErhLoadReport(report), "utf8");
    console.log(formatDistributionB2ErhLoadReport(report));
  } else if (parsedArgs.target === "pglite") {
    const report = await runDistributionB2ErhPgliteValidationFromDumpFile(dumpPath, request);
    await writeFile(resolve(outputDir, "distribution-b2-erh-pglite.json"), serializeDistributionB2ErhPgliteValidationReport(report), "utf8");
    await writeFile(resolve(outputDir, "distribution-b2-erh-pglite.md"), formatDistributionB2ErhPgliteValidationReport(report), "utf8");
    console.log(formatDistributionB2ErhPgliteValidationReport(report));
  } else {
    const report = await runDistributionB2ErhPostgresLoadFromDumpFile(dumpPath, request, { force: parsedArgs.force, reset: parsedArgs.reset, env: process.env, progress });
    await writeFile(resolve(outputDir, "distribution-b2-erh-postgres.json"), serializeDistributionB2ErhPostgresLoadReport(report), "utf8");
    await writeFile(resolve(outputDir, "distribution-b2-erh-postgres.md"), formatDistributionB2ErhPostgresLoadReport(report), "utf8");
    console.log(formatDistributionB2ErhPostgresLoadReport(report));
    if (report.status !== "pass") {
      process.exitCode = 1;
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

function parsePositionals(positionals, verifyOnly) {
  if (!verifyOnly) {
    if (positionals.length !== 3) {
      return null;
    }

    return {
      dumpPathArg: positionals[0],
      contractPathArg: positionals[1],
      outputDirArg: positionals[2]
    };
  }

  if (positionals.length === 1) {
    return {
      dumpPathArg: null,
      contractPathArg: null,
      outputDirArg: positionals[0]
    };
  }

  if (positionals.length === 2) {
    return {
      dumpPathArg: null,
      contractPathArg: positionals[0],
      outputDirArg: positionals[1]
    };
  }

  if (positionals.length === 3) {
    return {
      dumpPathArg: positionals[0],
      contractPathArg: positionals[1],
      outputDirArg: positionals[2]
    };
  }

  return null;
}

function defaultContractPath(baseDir) {
  return resolve(baseDir, "data/dumps/b2-erh-contract.json");
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
