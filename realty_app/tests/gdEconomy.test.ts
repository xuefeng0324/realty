import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGdEconomyTrend,
  getLatestGdEconomy,
  loadGdEconomyFromCSV
} from "../src/local/gdEconomy";

describe("gd economy", () => {
  it("加载广东经济运行简况（含 GDP 与人均可支配收入）", () => {
    const latest = getLatestGdEconomy();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_H1");
    expect(latest!.gdpYi).toBe(72281.05);
    expect(latest!.gdpYoyPct).toBe(4.5);
    expect(latest!.reInvestmentYoyPct).toBe(-21.6);
    expect(latest!.disposableYuan).toBe(29667);
    expect(latest!.disposableNominalYoyPct).toBe(4.7);
    expect(latest!.disposableRealYoyPct).toBe(3.9);
    expect(latest!.urbanDisposableYuan).toBe(35358);
    expect(latest!.ruralDisposableYuan).toBe(15493);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdEconomyTrend(2).length).toBeGreaterThanOrEqual(2);
    const annual = getGdEconomyTrend(8).find((r) => r.period === "2025");
    expect(annual).toBeTruthy();
    expect(annual!.gdpYi).toBe(145846.76);
    expect(annual!.disposableYuan).toBe(53669);
    expect(annual!.disposableNominalYoyPct).toBe(4.3);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_economy.py"), "utf8");
    expect(script).toContain("经济运行简况");
    expect(script).toContain("居民人均可支配收入");
    expect(script).toContain("stats.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGdEconomy");
    expect(dash).toContain("data-gd-economy");
    expect(dash).toContain("formatMacroYuan");
  });

  it("CSV 解析", () => {
    const rows = loadGdEconomyFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,gdp_yi,gdp_yoy_pct,primary_va_yi,primary_yoy_pct,secondary_va_yi,secondary_yoy_pct,tertiary_va_yi,tertiary_yoy_pct,industry_yoy_pct,retail_yoy_pct,fa_yoy_pct,re_investment_yoy_pct,cpi_yoy_pct,disposable_yuan,disposable_nominal_yoy_pct,disposable_real_yoy_pct,urban_disposable_yuan,urban_nominal_yoy_pct,rural_disposable_yuan,rural_nominal_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-01-01,2099-06,100,1,1,1,2,2,3,3,4,5,-6,-7,0.5,20000,2,1.5,25000,1.8,12000,3,测试,广东省统计局,http://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.gdpYi).toBe(100);
    expect(rows[0]!.disposableYuan).toBe(20000);
    expect(rows[0]!.reInvestmentYoyPct).toBe(-7);
  });
});
