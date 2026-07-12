import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(root, "apps", "hq", "dist");
const assetsDirectory = path.join(distDirectory, "assets");
const indexPath = path.join(distDirectory, "index.html");

const budgets = {
  initialJsBytes: 380_000,
  initialCssBytes: 70_000,
  landingImageBytes: 160_000,
  officeJsBytes: 210_000
};

function bytesFor(fileName) {
  return fs.statSync(path.join(assetsDirectory, fileName)).size;
}

function referencedAssets(indexHtml, pattern) {
  return [...indexHtml.matchAll(pattern)].map((match) => path.basename(match[1]));
}

function assertBudget(label, actual, budget) {
  if (actual > budget) {
    throw new Error(`${label} budget exceeded: ${actual} bytes > ${budget} bytes`);
  }

  console.log(`PASS ${label}: ${actual} bytes / ${budget} bytes`);
}

if (!fs.existsSync(indexPath) || !fs.existsSync(assetsDirectory)) {
  throw new Error("HQ build output is missing; run corepack pnpm --filter @ehq/hq build first.");
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
if (/workspace-office-[^"']+\.css/u.test(indexHtml)) {
  throw new Error("Public entry must not load the Office workspace stylesheet.");
}

const initialJsAssets = referencedAssets(indexHtml, /(?:src|href)="([^"]+\.js)"/gu);
const initialCssAssets = referencedAssets(indexHtml, /href="([^"]+\.css)"/gu);
const initialJsBytes = initialJsAssets.reduce((total, fileName) => total + bytesFor(fileName), 0);
const initialCssBytes = initialCssAssets.reduce((total, fileName) => total + bytesFor(fileName), 0);
const landingImage = fs.readdirSync(assetsDirectory).find((fileName) => /^hq-landing-command-room(?:-[^/]+)?\.webp$/u.test(fileName));
const officeJs = fs.readdirSync(assetsDirectory).find((fileName) => /^workspace-office-[^/]+\.js$/u.test(fileName));

if (landingImage === undefined || officeJs === undefined) {
  throw new Error("Expected landing WebP and Office workspace chunk are missing.");
}

assertBudget("initial JS", initialJsBytes, budgets.initialJsBytes);
assertBudget("initial CSS", initialCssBytes, budgets.initialCssBytes);
assertBudget("landing WebP", bytesFor(landingImage), budgets.landingImageBytes);
assertBudget("Office workspace JS", bytesFor(officeJs), budgets.officeJsBytes);