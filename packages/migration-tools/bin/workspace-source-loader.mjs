const workspaceRoot = new URL("../../../", import.meta.url);
const workspaceAliases = new Map([
  ["@ehq/db", "packages/db/src/index.ts"],
  ["@ehq/domain-distribution", "packages/domain-distribution/src/index.ts"],
  ["@ehq/domain-finance", "packages/domain-finance/src/index.ts"],
  ["@ehq/domain-office", "packages/domain-office/src/index.ts"]
]);

export async function resolve(specifier, context, nextResolve) {
  const workspaceAliasPath = workspaceAliases.get(specifier);
  if (workspaceAliasPath !== undefined) {
    return {
      url: new URL(workspaceAliasPath, workspaceRoot).href,
      shortCircuit: true
    };
  }

  if (context.parentURL?.includes("/dist/") || context.parentURL?.includes("/node_modules/")) {
    return nextResolve(specifier, context);
  }

  if (
    specifier.endsWith(".js") &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    return nextResolve(specifier.slice(0, -3) + ".ts", context);
  }

  return nextResolve(specifier, context);
}
