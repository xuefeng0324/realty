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
    expect(latest!.period).toBe("2026_H1");
    expect(latest!.disposableYuan).toBe(22981);
    expect(latest!.disposableNominalYoyPct).toBe(5.2);
    expect(latest!.disposableRealYoyPct).toBe(4.2);
    expect(latest!.urbanDisposableYuan).toBe(30126);
    expect(latest!.ruralDisposableYuan).toBe(12699);
    expect(latest!.consumptionYuan).toBe(14836);
    expect(latest!.housingConsumptionYuan).toBe(3135);
    expect(latest!.housingConsumptionYoyPct).toBe(1.4);
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
