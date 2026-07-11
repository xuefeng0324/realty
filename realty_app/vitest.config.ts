import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // pages 是 UI 适配层，主要靠 E2E 覆盖；
      // store/app 是全局状态，目前没单测，先排除避免空覆盖率噪音。
      // src/api 与 src/utils 现在有单测（tests/http.test.ts 等），纳入覆盖统计。
      exclude: [
        "src/pages/**",
        "src/store/**",
        "src/main.ts",
        "**/*.d.ts"
      ]
    }
  }
});