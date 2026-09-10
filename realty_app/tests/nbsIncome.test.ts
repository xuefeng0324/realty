import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsIncome,
  getNbsIncomeTrend,
  loadNbsIncomeFromCSV
} from "../src/local/nbsIncome";

describe("nbs income", () => {
  it("加载全国居民收入和消费", () => {
    const latest = getLatestNbsIncome();
    expect(latest).not.toBeNull();
    // v1.122.29 修：cron 每月自动补最新半年报，period 不能硬编码为 2026_H1
    // 改用 regex 兼容任何 2026+ 上/下半年
    expect(latest!.period).toMatch(/^20\d{2}_H[12]$/);
    // 数值改成合理范围（cron 自动补半年报后 H2 数值会变）
    expect(latest!.disposableYuan).toBeGreaterThan(15000);
    expect(latest!.disposableYuan).toBeLessThan(40000);
    expect(latest!.disposableNominalYoyPct).toBeGreaterThan(0);
    expect(latest!.disposableNominalYoyPct).toBeLessThan(10);
    expect(latest!.disposableRealYoyPct).toBeGreaterThan(0);
    expect(latest!.disposableRealYoyPct).toBeLessThan(10);
    expect(latest!.urbanDisposableYuan).toBeGreaterThan(20000);
    expect(latest!.urbanDisposableYuan).toBeLessThan(50000);
    expect(latest!.ruralDisposableYuan).toBeGreaterThan(8000);
    expect(latest!.ruralDisposableYuan).toBeLessThan(25000);
    expect(latest!.consumptionYuan).toBeGreaterThan(10000);
    expect(latest!.consumptionYuan).toBeLessThan(30000);
    expect(latest!.housingConsumptionYuan).toBeGreaterThan(2000);
    expect(latest!.housingConsumptionYuan).toBeLessThan(6000);
    expect(latest!.housingConsumptionYoyPct).toBeGreaterThan(-5);
    expect(latest!.housingConsumptionYoyPct).toBeLessThan(10);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsIncomeTrend(8).length).toBeGreaterThanOrEqual(6);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_income.py"), "utf8");
    expect(script).toContain("居民收入和消费支出情况");
    expect(script).toContain("housing_consumption");
    expect(script).toContain("stats.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(dash).toContain("getLatestNbsIncome");
    expect(dash).toContain("data-nbs-income");
    expect(dash).toContain("居住消费 · 非房价");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsIncomeFromCSV(
      [
        "period,period_label,publish_date,sort_key,disposable_yuan,disposable_nominal_yoy_pct,disposable_real_yoy_pct,urban_disposable_yuan,urban_nominal_yoy_pct,urban_real_yoy_pct,rural_disposable_yuan,rural_nominal_yoy_pct,rural_real_yoy_pct,consumption_yuan,consumption_nominal_yoy_pct,consumption_real_yoy_pct,housing_consumption_yuan,housing_consumption_yoy_pct,source_url",
        "2099_H1,2099年上半年,2099-07-01,2099-06,1,1,1,1,1,1,1,1,1,1,1,1,1,1,https://example.com/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});
