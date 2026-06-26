const workspaceAliases = new Map([
  ["@ehq/api-client", "../../../packages/api-client/src/index.ts"],
  ["@ehq/db", "../../../packages/db/src/index.ts"],
  ["@ehq/domain-distribution", "../../../packages/domain-distribution/src/index.ts"],
  ["@ehq/domain-finance", "../../../packages/domain-finance/src/index.ts"],
  ["@ehq/domain-office", "../../../packages/domain-office/src/index.ts"]
]);

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes("/dist/") || context.parentURL?.includes("/node_modules/")) {
    return nextResolve(specifier, context);
  }

  const alias = workspaceAliases.get(specifier);
  if (alias !== undefined) {
    return {
      shortCircuit: true,
      url: new URL(alias, import.meta.url).href
    };
  }

  if (
    specifier.endsWith(".js") &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    return nextResolve(specifier.slice(0, -3) + ".ts", context);
  }

  return nextResolve(specifier, context);
}
