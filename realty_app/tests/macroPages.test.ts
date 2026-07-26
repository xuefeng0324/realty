import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 宏观 5 子页骨架 smoke 测试。
 *
 * 验收标准（F-PAGES-MACRO-*）：
 *  - 5 个子页文件存在：macro-rates / macro-fx / macro-industry / macro-region / macro-trade
 *  - 每个子页：顶部含 MacroTabNav 组件 + active 属性正确
 *  - pages.json 已注册 5 个路由
 *  - MacroTabNav 组件渲染 5 个 tab（rates / fx / industry / region / trade）
 *  - homeEntry.ts 的"宏观"tile 已 navigate 到 macro-region（非 scroll）
 *
 * 详见 docs/DASHBOARD_OVERVIEW_BUDGET.md §2。
 */
describe("宏观 5 子页骨架 PAGES_MACRO_*", () => {
  const pagesDir = resolve(__dirname, "../src/pages");
  const compDir = resolve(__dirname, "../src/components");
  const configDir = resolve(__dirname, "../src");

  const pages = [
    { key: "rates", file: "macro-rates/macro-rates.vue" },
    { key: "fx", file: "macro-fx/macro-fx.vue" },
    { key: "industry", file: "macro-industry/macro-industry.vue" },
    { key: "region", file: "macro-region/macro-region.vue" },
    { key: "trade", file: "macro-trade/macro-trade.vue" }
  ];

  pages.forEach(({ key, file }) => {
    it(`${key} 子页文件存在且含 MacroTabNav 组件引用`, () => {
      const path = resolve(pagesDir, file);
      expect(existsSync(path)).toBe(true);
      const src = readFileSync(path, "utf8");
      expect(src).toContain("MacroTabNav");
      expect(src).toContain(`active="${key}"`);
    });
  });

  it("MacroTabNav 组件存在并导出 5 tab", () => {
    const compPath = resolve(compDir, "MacroTabNav.vue");
    expect(existsSync(compPath)).toBe(true);
    const src = readFileSync(compPath, "utf8");
    expect(src).toContain('"rates"');
    expect(src).toContain('"fx"');
    expect(src).toContain('"industry"');
    expect(src).toContain('"region"');
    expect(src).toContain('"trade"');
    expect(src).toContain("uni.redirectTo");
  });

  it("pages.json 注册 5 个宏观路由", () => {
    const pagesJson = readFileSync(
      resolve(__dirname, "../src/pages.json"),
      "utf8"
    );
    for (const { file } of pages) {
      expect(pagesJson).toContain(`pages/${file.replace(/\.vue$/, "")}`);
    }
  });

  it("homeEntry.ts 宏观 tile 改 navigate → macro-region（非 scroll）", () => {
    const homeEntry = readFileSync(resolve(configDir, "local/homeEntry.ts"), "utf8");
    expect(homeEntry).toMatch(
      /key:\s*"macro"[\s\S]{0,200}kind:\s*"navigate"[\s\S]{0,200}macro-region/
    );
  });
});