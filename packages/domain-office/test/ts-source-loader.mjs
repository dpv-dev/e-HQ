export async function resolve(specifier, context, nextResolve) {
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
