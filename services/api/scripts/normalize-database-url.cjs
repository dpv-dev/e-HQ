const rawDatabaseUrl = process.env.DATABASE_URL;

if (typeof rawDatabaseUrl === "string" && rawDatabaseUrl.length > 0) {
  let normalizedDatabaseUrl = rawDatabaseUrl.trim();

  if (normalizedDatabaseUrl.length >= 2) {
    const first = normalizedDatabaseUrl[0];
    const last = normalizedDatabaseUrl[normalizedDatabaseUrl.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      normalizedDatabaseUrl = normalizedDatabaseUrl.slice(1, -1);
    }
  }

  normalizedDatabaseUrl = normalizedDatabaseUrl
    .replace("?sslmode=require&", "?")
    .replace("&sslmode=require", "")
    .replace("?sslmode=require", "");

  process.env.DATABASE_URL = normalizedDatabaseUrl;
}
