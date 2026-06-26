import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./migrations",
  schema: ["./src/office/schema.ts", "./src/distribution/schema.ts"],
  strict: true,
  verbose: true
});
