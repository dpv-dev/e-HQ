import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type MutableEnvironment = Record<string, string | undefined>;

export function loadRuntimeEnvironment(environment: MutableEnvironment, startPath: string): void {
  const envFilePath = resolveRuntimeEnvPath(startPath);
  if (!existsSync(envFilePath)) {
    return;
  }

  applyRuntimeEnvText(environment, readFileSync(envFilePath, "utf8"));
}

export function applyRuntimeEnvText(environment: MutableEnvironment, envFile: string): void {
  for (const line of envFile.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = unquoteEnvValue(trimmedLine.slice(equalsIndex + 1).trim());
    const currentValue = environment[key];
    if (currentValue === undefined || shouldRepairHostingerBoolean(key, currentValue, value)) {
      environment[key] = value;
    }
  }
}

export function resolveRuntimeEnvPath(startPath: string): string {
  // Hostinger keeps the Node slot environment beside the runtime directory.
  const hostingerCandidate = resolve(startPath, "../public_html/.builds/config/.env");
  if (existsSync(hostingerCandidate)) {
    return hostingerCandidate;
  }

  let currentDirectory = startPath;
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const candidate = resolve(currentDirectory, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (existsSync(resolve(currentDirectory, ".git"))) {
      break;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return resolve(startPath, ".env");
}

function unquoteEnvValue(rawValue: string): string {
  if (rawValue.length < 2) {
    return rawValue;
  }

  const quote = rawValue[0];
  if ((quote === "\"" && rawValue.endsWith("\"")) || (quote === "'" && rawValue.endsWith("'"))) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function shouldRepairHostingerBoolean(key: string, currentValue: string, fileValue: string): boolean {
  if (key !== "WRITES_ENABLED") {
    return false;
  }

  return isBooleanEnvValue(fileValue) && !isBooleanEnvValue(currentValue);
}

function isBooleanEnvValue(value: string): boolean {
  return value === "true" || value === "false" || value === "1" || value === "0";
}
