import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // src/api 与 src/pages 是 UI/HTTP 适配层，主要靠 E2E 与 pipeline.test 覆盖
      exclude: [
        "src/pages/**",
        "src/store/**",
        "src/main.ts",
        "**/*.d.ts"
      ]
    }
  }
});