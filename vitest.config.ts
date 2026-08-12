import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    // tsconfig の paths("@/*" → "./src/*")を vitest にも適用する
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/__tests__/**"],
      // SPEC N-02: src/core は lines/functions/statements ≥ 90%, branches ≥ 85%
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
