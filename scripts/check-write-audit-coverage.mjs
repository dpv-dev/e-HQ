import { readFile } from "node:fs/promises";
import ts from "../node_modules/typescript/lib/typescript.js";

const sourcePath = new URL("../services/api/src/index.ts", import.meta.url);
const sourceText = await readFile(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath.pathname, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const missing = [];
let mutationCount = 0;

function containsAuditAppend(node) {
  let found = false;
  function visit(child) {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "appendAuditEvent"
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "runIdempotentMutation"
  ) {
    mutationCount += 1;
    const config = node.arguments[0];
    const write = config !== undefined && ts.isObjectLiteralExpression(config)
      ? config.properties.find((property) => property.name?.getText(source) === "write")
      : undefined;
    if (write === undefined || !containsAuditAppend(write)) {
      const location = source.getLineAndCharacterOfPosition(node.getStart(source));
      missing.push(location.line + 1);
    }
  }
  ts.forEachChild(node, visit);
}

visit(source);
if (missing.length > 0) {
  console.error(`Audit coverage failed: runIdempotentMutation without appendAuditEvent at index.ts lines ${missing.join(", ")}.`);
  process.exit(1);
}
console.log(`Audit coverage passed: ${mutationCount} idempotent write paths append an audit event.`);
