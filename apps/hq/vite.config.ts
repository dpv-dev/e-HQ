import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: "strip-public-office-css",
      enforce: "post",
      transformIndexHtml(html: string): string {
        return html.replace(/\s*<link rel="stylesheet"[^>]*href="[^"]*workspace-office-[^"]+\.css"[^>]*>/u, "");
      }
    }
  ],
  build: {
    modulePreload: {
      resolveDependencies(_filename: string, deps: readonly string[]): string[] {
        return deps.filter((dependency: string): boolean => !/workspace-(office|distribution|command-center)/u.test(dependency));
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes("/packages/ui/")) {
            return "ui";
          }

          if (id.includes("/packages/auth/") || id.includes("/packages/api-client/")) {
            return "core";
          }

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
