#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createOfficeB2LoadRequest,
  formatOfficeB2PgliteValidationReport,
  runOfficeB2PgliteValidationFromSql,
  serializeOfficeB2PgliteValidationReport
} from "../src/index.ts";

const args = process.argv.slice(2);
const [dumpPathArg, outputDirArg] = args[0] === "--" ? args.slice(1) : args;

if (dumpPathArg === undefined || outputDirArg === undefined) {
  console.error("Usage: pnpm --filter @ehq/migration-tools office:b2-pglite -- <dump.sql> <output-dir>");
  process.exitCode = 1;
} else {
  const dumpPath = resolve(dumpPathArg);
  const outputDir = resolve(outputDirArg);
  const sql = await readFile(dumpPath, "utf8");
  const request = createOfficeB2LoadRequest(new Date().toISOString(), dumpPath);
  const report = await runOfficeB2PgliteValidationFromSql(sql, request);
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "office-b2-pglite.json"), serializeOfficeB2PgliteValidationReport(report), "utf8");
  await writeFile(resolve(outputDir, "office-b2-pglite.md"), formatOfficeB2PgliteValidationReport(report), "utf8");
  console.log(formatOfficeB2PgliteValidationReport(report));
}
