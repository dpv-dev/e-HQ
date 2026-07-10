import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes("/src/app/canonical/office/")) {
            return "workspace-office";
          }

          if (id.includes("/src/app/canonical/distribution/")) {
            return "workspace-distribution";
          }

          if (id.includes("/src/app/canonical/command-center/")) {
            return "workspace-command-center";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  }
});
