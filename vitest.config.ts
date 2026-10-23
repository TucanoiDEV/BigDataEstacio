import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

const shared = {
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" lança erro fora de Server Components; nos testes é neutralizado.
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          setupFiles: ["tests/support/unit-env.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/support/integration-env.ts"],
          globalSetup: ["tests/support/integration-global.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
