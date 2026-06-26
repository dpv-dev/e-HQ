#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createDistributionB2ErhLoadRequest,
  formatDistributionB2ErhPgliteValidationReport,
  runDistributionB2ErhPgliteValidationFromDumpFile,
  serializeDistributionB2ErhPgliteValidationReport
} from "../src/index.ts";

const args = process.argv.slice(2);
const [dumpPathArg, contractPathArg, outputDirArg] = args[0] === "--" ? args.slice(1) : args;

if (dumpPathArg === undefined || contractPathArg === undefined || outputDirArg === undefined) {
  console.error("Usage: pnpm --filter @ehq/migration-tools erh:b2-pglite -- <dump.sql> <contract.json> <output-dir>");
  process.exitCode = 1;
} else {
  const dumpPath = resolve(dumpPathArg);
  const contractPath = resolve(contractPathArg);
  const outputDir = resolve(outputDirArg);
  const contractJson = JSON.parse(await readFile(contractPath, "utf8"));
  const request = createDistributionB2ErhLoadRequest(new Date().toISOString(), dumpPath, contractJson);
  const report = await runDistributionB2ErhPgliteValidationFromDumpFile(dumpPath, request);
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "distribution-b2-erh-pglite.json"), serializeDistributionB2ErhPgliteValidationReport(report), "utf8");
  await writeFile(resolve(outputDir, "distribution-b2-erh-pglite.md"), formatDistributionB2ErhPgliteValidationReport(report), "utf8");
  console.log(formatDistributionB2ErhPgliteValidationReport(report));
}
