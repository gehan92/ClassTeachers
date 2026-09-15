import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Deliberately narrow scope for now: pure-logic unit tests only (no jsdom/
// React rendering setup) — see src/lib/**/*.test.ts. Covers the app's first
// automated tests at all; broadening to component/integration tests is a
// separate, bigger decision left for later.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      // See src/test/server-only-shim.ts for why this is needed under Vitest.
      "server-only": path.resolve(dirname, "./src/test/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
