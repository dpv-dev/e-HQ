#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const domainSpecs = [
  {
    name: "office",
    usageFiles: [
      "apps/hq/src/app/canonical/office/App.svelte",
      "apps/hq/src/app/canonical/office/BankView.svelte",
      "apps/hq/src/app/canonical/office/CeoView.svelte",
      "apps/hq/src/app/canonical/office/MonitoringView.svelte",
      "apps/hq/src/app/canonical/office/PartnersView.svelte",
      "apps/hq/src/app/canonical/office/ProjectsView.svelte",
      "apps/hq/src/app/canonical/office/SettingsView.svelte",
      "apps/hq/src/app/canonical/office/VatView.svelte"
    ],
    usagePatterns: [
      /client\.office\.([A-Za-z0-9_]+)/g,
      /props\.client\.([A-Za-z0-9_]+)/g
    ],
    clientFile: "packages/api-client/src/office.ts",
    interfaceName: "OfficeApiClient"
  },
  {
    name: "distribution",
    usageFiles: ["apps/hq/src/app/canonical/distribution/App.svelte"],
    usagePatterns: [/client\.distribution\.([A-Za-z0-9_]+)/g],
    clientFile: "packages/api-client/src/distribution.ts",
    interfaceName: "DistributionApiClient"
  },
  {
    name: "command-center",
    usageFiles: ["apps/hq/src/app/canonical/command-center/App.svelte"],
    usagePatterns: [/client\.commandCenter\.([A-Za-z0-9_]+)/g],
    clientFile: "packages/api-client/src/command-center.ts",
    interfaceName: "CommandCenterApiClient"
  }
];

async function readText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

function collectUsages(source, patterns) {
  const used = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) {
        used.add(match[1]);
      }
    }
  }
  return used;
}

function parseInterfaceMethods(source, interfaceName) {
  const interfaceStart = source.indexOf(`export interface ${interfaceName}`);
  if (interfaceStart === -1) {
    throw new Error(`Interface ${interfaceName} not found.`);
  }

  const blockStart = source.indexOf("{", interfaceStart);
  if (blockStart === -1) {
    throw new Error(`Interface block start not found for ${interfaceName}.`);
  }

  let depth = 0;
  let blockEnd = -1;
  for (let i = blockStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockEnd === -1) {
    throw new Error(`Interface block end not found for ${interfaceName}.`);
  }

  const block = source.slice(blockStart, blockEnd + 1);
  const methods = new Set();
  const lines = block.split(/\r?\n/u);

  let nestingDepth = 0;
  for (const line of lines) {
    if (nestingDepth === 1) {
      const match = line.match(/^\s*readonly\s+([A-Za-z0-9_]+)\s*:/u);
      if (match !== null) {
        methods.add(match[1]);
      }
    }

    for (const char of line) {
      if (char === "{") {
        nestingDepth += 1;
      } else if (char === "}") {
        nestingDepth -= 1;
      }
    }
  }
  return methods;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function run() {
  let hasError = false;

  for (const spec of domainSpecs) {
    const usageTexts = await Promise.all(spec.usageFiles.map((path) => readText(path)));
    const usageMethods = new Set();
    for (const text of usageTexts) {
      const fromFile = collectUsages(text, spec.usagePatterns);
      for (const method of fromFile) {
        usageMethods.add(method);
      }
    }

    const clientText = await readText(spec.clientFile);
    const clientMethods = parseInterfaceMethods(clientText, spec.interfaceName);

    const missingInClient = sorted([...usageMethods].filter((method) => !clientMethods.has(method)));
    const notUsedByUi = sorted([...clientMethods].filter((method) => !usageMethods.has(method)));

    if (missingInClient.length > 0) {
      hasError = true;
      console.error(`\n[FAIL] ${spec.name}: UI calls missing in ${spec.interfaceName}`);
      for (const method of missingInClient) {
        console.error(`- ${method}`);
      }
    } else {
      console.log(`\n[OK] ${spec.name}: every referenced UI method exists in ${spec.interfaceName}.`);
    }

    if (notUsedByUi.length > 0) {
      console.log(`[INFO] ${spec.name}: client methods currently not used by UI (${notUsedByUi.length}).`);
      for (const method of notUsedByUi) {
        console.log(`- ${method}`);
      }
    }
  }

  if (hasError) {
    process.exitCode = 1;
    return;
  }

  console.log("\nUI/API connection check passed.");
}

run().catch((error) => {
  console.error("check-ui-api-connections failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
