export async function resolve(specifier, context, nextResolve) {
  if (
    specifier.endsWith(".js") &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    return nextResolve(specifier.slice(0, -3) + ".ts", context);
  }

  return nextResolve(specifier, context);
}
