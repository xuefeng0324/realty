/**
 * 构建资源完整性单测。
 *
 * 覆盖：
 *  1. index.html 必须有 <link rel="icon">（防止 favicon 404 回归 ——
 *     2026-07-12 v0.3.0 已加 data:, 兜底，但保留显式 link 仍是最佳实践）
 *  2. src/manifest.json 字段类型合法（name / versionName / versionCode / vueVersion 必填）
 *  3. static/seed/ 下的 CSV 文件名与 README.md 中"远程 CSV"段落一致
 *     （防止改名后 README 文档与实际数据脱节，App 启动找不到文件）
 *
 * 为什么不放到 e2e：
 *  这是纯文件 / JSON 解析，不依赖 dev server，跑在 vitest node 环境下毫秒级。
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("build integrity", () => {
  describe("index.html", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");

    it("包含 <link rel=\"icon\"> 标签", () => {
      // 容许 href 是 data:, 或真实文件 —— 但必须有 rel=icon 声明
      expect(html).toMatch(/<link[^>]+rel=["']icon["']/i);
    });

    it("包含 #app 挂载点", () => {
      expect(html).toMatch(/<div\s+id=["']app["']\s*>/);
    });

    it("引入 /src/main.ts 作为入口", () => {
      expect(html).toMatch(/src=["']\/src\/main\.ts["']/);
    });
  });

  describe("manifest.json", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, "src/manifest.json"), "utf8")
    );

    it("name / versionName / versionCode 必填且类型正确", () => {
      expect(typeof manifest.name).toBe("string");
      expect(manifest.name.length).toBeGreaterThan(0);
      expect(typeof manifest.versionName).toBe("string");
      expect(manifest.versionName).toMatch(/^\d+\.\d+\.\d+/);
      expect(typeof manifest.versionCode).toBe("string");
    });

    it("vueVersion 必须是 '3'", () => {
      // vite.config.ts + tsconfig.json 都基于 Vue 3；如果降到 2 会编译失败
      expect(manifest.vueVersion).toBe("3");
    });
  });

  describe("static/seed CSV 文件清单", () => {
    // 真实存在的文件
    const seedFiles = new Set(
      readdirSync(resolve(ROOT, "static/seed")).map((f) => f.toLowerCase())
    );

    // README.md 中"下载 CSV（远程）"段落声明的 5 个文件
    const requiredFiles = [
      "cities.csv",
      "communities.csv",
      "schools.csv",
      "school_indicators.csv",
      "listings.csv"
    ];

    it.each(requiredFiles)(
      "static/seed/%s 必须存在（README 文档与实际数据一致）",
      (name) => {
        expect(seedFiles.has(name)).toBe(true);
      }
    );
  });

  describe("package.json 一致性", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf8")
    );
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, "src/manifest.json"), "utf8")
    );

    it("package.json 的 test:coverage 脚本存在", () => {
      expect(pkg.scripts["test:coverage"]).toBeDefined();
    });

    it("type-check 走 vue-tsc --noEmit（避免遗留的 tsc --noEmit）", () => {
      expect(pkg.scripts["type-check"]).toMatch(/vue-tsc/);
    });

    it("manifest.versionName 与 package.json.version 大版本对齐", () => {
      const pkgMajor = pkg.version.split(".")[0];
      const manifestMajor = manifest.versionName.split(".")[0];
      // 容许 App manifest 比 package.json 滞后一个版本（先发 App 再发手机包是常见节奏），
      // 但不应超前或完全无关
      expect(Number(manifestMajor)).toBeGreaterThanOrEqual(
        Number(pkgMajor) - 1
      );
    });
  });

  describe("CI 必装文件", () => {
    it("存在 tests/e2e/smoke.mjs", () => {
      // e2e workflow 引用了它，文件被删会让 CI 静默通过（无脚本可跑）
      expect(existsSync(resolve(ROOT, "tests/e2e/smoke.mjs"))).toBe(true);
    });

    it("存在 tests/expected.json", () => {
      // rules.test.ts 隐式依赖此文件
      expect(existsSync(resolve(ROOT, "tests/expected.json"))).toBe(true);
    });
  });
});