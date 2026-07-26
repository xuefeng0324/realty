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

  it("macro-region 子页迁入了 4 张广东卡（数据 + 模板）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-region/macro-region.vue"),
      "utf8"
    );
    expect(src).toContain("data-gd-real-estate-brief");
    expect(src).toContain("data-gd-economy");
    expect(src).toContain("data-gd-fa-investment");
    expect(src).toContain("data-gd-construction");
    expect(src).toContain("getLatestGdRealEstateBrief");
    expect(src).toContain("getLatestGdEconomy");
  });

  it("macro-industry 子页迁入了 8 张产业卡（数据 + 模板）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-industry/macro-industry.vue"),
      "utf8"
    );
    expect(src).toContain("data-nbs-fa-investment");
    expect(src).toContain("data-nbs-income");
    expect(src).toContain("data-nbs-cpi");
    expect(src).toContain("data-nbs-pmi");
    expect(src).toContain("data-nbs-industrial");
    expect(src).toContain("data-nbs-industrial-profit");
    expect(src).toContain("data-nbs-ppi");
    expect(src).toContain("data-nbs-retail");
    expect(src).toContain("getLatestNbsIndustrialProfit");
    expect(src).toContain("getLatestNbsPmi");
  });

  it("macro-trade 子页迁入了 1 张贸易卡（数据 + 模板）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-trade/macro-trade.vue"),
      "utf8"
    );
    expect(src).toContain("data-nbs-trade");
    expect(src).toContain("getLatestNbsTrade");
  });

  it("macro-fx 子页迁入了 8 张汇市卡（数据 + 模板 + 字段）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-fx/macro-fx.vue"),
      "utf8"
    );
    // 8 张卡的 data-* 属性
    expect(src).toContain("data-safe-forex");
    expect(src).toContain("data-safe-ora");
    expect(src).toContain("data-safe-usd-mid");
    expect(src).toContain("data-safe-fx-market");
    expect(src).toContain("data-safe-settle");
    expect(src).toContain("data-safe-bop");
    expect(src).toContain("data-safe-iip");
    expect(src).toContain("data-safe-bop-trade");
    // 8 个 getter 引用
    expect(src).toContain("getLatestSafeForex");
    expect(src).toContain("getLatestSafeOra");
    expect(src).toContain("getLatestSafeUsdMid");
    expect(src).toContain("getLatestSafeFxMarket");
    expect(src).toContain("getLatestSafeSettle");
    expect(src).toContain("getLatestSafeBop");
    expect(src).toContain("getLatestSafeIip");
    expect(src).toContain("getLatestSafeBopTrade");
    // KPI 卡片组件
    expect(src).toContain("MacroKpiCell");
  });

  it("macro-rates 子页迁入了 6 张利率卡（数据 + 模板 + 字段）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-rates/macro-rates.vue"),
      "utf8"
    );
    // 6 张卡的 data-* 属性
    expect(src).toContain("data-lpr-history");
    expect(src).toContain("data-mlf-history");
    expect(src).toContain("data-omo-rr-history");
    expect(src).toContain("data-shibor");
    expect(src).toContain("data-china-bond-yield");
    expect(src).toContain("data-repo-fixing");
    // 6 个 getter 引用
    expect(src).toContain("getLprLatest");
    expect(src).toContain("getLatestMlf");
    expect(src).toContain("getLatestOmoRr");
    expect(src).toContain("getLatestShibor");
    expect(src).toContain("getLatestChinaBondYield");
    expect(src).toContain("getLatestRepoFixing");
    // KPI 卡片组件
    expect(src).toContain("MacroKpiCell");
  });

  it("macro-rates 子页 T-009 聚合趋势卡（6 项指标 + 6 期序列）", () => {
    const src = readFileSync(
      resolve(pagesDir, "macro-rates/macro-rates.vue"),
      "utf8"
    );
    // 聚合卡 data 属性 + computed 名
    expect(src).toContain("data-rates-trend-summary");
    expect(src).toContain("rateTrendRows");
    expect(src).toContain("trendWindowLabel");
    // 6 个 history getter（聚合卡用）
    expect(src).toContain("getLprHistory");
    expect(src).toContain("getMlfHistory");
    expect(src).toContain("getOmoRrHistory");
    expect(src).toContain("getShiborHistory");
    expect(src).toContain("getChinaBondYieldHistory");
    expect(src).toContain("getRepoFixingHistory");
    // 6 项指标 label
    expect(src).toContain("LPR 5y");
    expect(src).toContain("MLF 1y");
    expect(src).toContain("OMO 7d");
    expect(src).toContain("Shibor ON");
    expect(src).toContain("国债 10y");
    expect(src).toContain("FR007");
    // 样式块（rate-trend-grid）
    expect(src).toContain(".rate-trend-grid");
    expect(src).toContain(".rate-trend-row");
    expect(src).toContain(".rate-trend-cells");
  });
});