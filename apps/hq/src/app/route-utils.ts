export function normalizeRoutePath(pathname: string): string {
  let normalizedPath = pathname.trim();

  if (normalizedPath.length === 0) {
    return "/";
  }

  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = normalizedPath.replace(/\/+/g, "/");
  normalizedPath = normalizedPath.replace(/\/+$/g, "");

  if (normalizedPath.length === 0) {
    return "/";
  }

  return normalizedPath;
}
