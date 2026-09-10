import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGdEconomyTrend,
  getLatestGdEconomy,
  getLatestGdEconomyPopulation,
  loadGdEconomyFromCSV
} from "../src/local/gdEconomy";

describe("gd economy", () => {
  it("加载广东经济运行简况（含 GDP、收入与年报人口）", () => {
    const latest = getLatestGdEconomy();
    expect(latest).not.toBeNull();
    // v1.122.29 修：cron 每月自动补最新月度/累计简讯，period 不能硬编码 2026_H1
    // 改用 regex 兼容任何 2026+ 月度/累计/半年/年度
    expect(latest!.period).toMatch(/^20\d{2}(_Q[1-4]|_H[12]|_\d{2}_\d{2}|\d{4})?$/);
    // 数值改成合理范围（cron 自动补后 GDP/收入/人口会变）
    expect(latest!.gdpYi).toBeGreaterThan(50000);
    expect(latest!.gdpYi).toBeLessThan(200000);
    expect(latest!.disposableYuan).toBeGreaterThan(20000);
    expect(latest!.disposableYuan).toBeLessThan(50000);
    // 月度简讯无人口字段 = 0；年报 / H1 简讯才有
    expect(latest!.permanentPopWan).toBeGreaterThanOrEqual(0);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdEconomyTrend(3).length).toBeGreaterThanOrEqual(3);

    const pop = getLatestGdEconomyPopulation();
    expect(pop).not.toBeNull();
    // 年报人口 period：年度（v1.122.19 已加 1-7 月补数据，period 会变成 2025）
    expect(pop!.period).toMatch(/^20\d{2}$/);
    expect(pop!.permanentPopWan).toBeGreaterThan(12000);
    expect(pop!.permanentPopWan).toBeLessThan(15000);
    expect(pop!.permanentPopDeltaWan).toBeGreaterThan(-100);
    expect(pop!.permanentPopDeltaWan).toBeLessThan(200);
    expect(pop!.urbanizationRatePct).toBeGreaterThan(70);
    expect(pop!.urbanizationRatePct).toBeLessThan(80);
    expect(pop!.urbanizationRatePp).toBeGreaterThan(-1);
    expect(pop!.urbanizationRatePp).toBeLessThan(2);

    const q3 = getGdEconomyTrend(8).find((r) => r.period === "2025_Q3");
    expect(q3).toBeTruthy();
    expect(q3!.gdpYi).toBeGreaterThan(80000);
    expect(q3!.gdpYi).toBeLessThan(120000);
    expect(q3!.gdpYoyPct).toBeGreaterThan(0);
    expect(q3!.gdpYoyPct).toBeLessThan(10);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_economy.py"), "utf8");
    expect(script).toContain("经济运行简况");
    expect(script).toContain("常住人口");
    expect(script).toContain("城镇化率");
    expect(script).toContain("index_4.html");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(dash).toContain("getLatestGdEconomyPopulation");
    expect(dash).toContain("data-gd-economy");
    expect(dash).toContain("macro-kicker");
    expect(dash).toContain("广东 · 宏观经济");
  });

  it("CSV 解析", () => {
    const rows = loadGdEconomyFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,gdp_yi,gdp_yoy_pct,primary_va_yi,primary_yoy_pct,secondary_va_yi,secondary_yoy_pct,tertiary_va_yi,tertiary_yoy_pct,industry_yoy_pct,retail_yoy_pct,fa_yoy_pct,re_investment_yoy_pct,cpi_yoy_pct,disposable_yuan,disposable_nominal_yoy_pct,disposable_real_yoy_pct,urban_disposable_yuan,urban_nominal_yoy_pct,rural_disposable_yuan,rural_nominal_yoy_pct,permanent_pop_wan,permanent_pop_delta_wan,urbanization_rate_pct,urbanization_rate_pp,title,source_org,source_url",
        "广东,2099,2099年,2099-01-01,2099-12,100,1,1,1,2,2,3,3,4,5,-6,-7,0.5,20000,2,1.5,25000,1.8,12000,3,10000,10,75.5,0.5,测试,广东省统计局,http://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.permanentPopWan).toBe(10000);
    expect(rows[0]!.urbanizationRatePct).toBe(75.5);
  });
});
