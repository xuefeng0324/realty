import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsRetail,
  getNbsRetailTrend,
  loadNbsRetailFromCSV,
  shortNbsRetailMonthLabel
} from "../src/local/nbsRetail";

describe("nbs retail", () => {
  it("加载社消装潢/家具月度", () => {
    const latest = getLatestNbsRetail();
    expect(latest).not.toBeNull();
    // v1.122.30 修：cron 每月自动补社消数据，month 不能硬编码 2026-06
    expect(latest!.month).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
    // 数值改成合理范围（建筑装潢月度 50-200 亿、家具月度 100-250 亿、YoY ±15%）
    expect(latest!.buildingMonthCny100m).toBeGreaterThan(50);
    expect(latest!.buildingMonthCny100m).toBeLessThan(200);
    expect(latest!.buildingMonthYoyPct).toBeGreaterThan(-15);
    expect(latest!.buildingMonthYoyPct).toBeLessThan(15);
    expect(latest!.buildingCumCny100m).toBeGreaterThan(300);
    expect(latest!.buildingCumCny100m).toBeLessThan(1200);
    expect(latest!.buildingCumYoyPct).toBeGreaterThan(-15);
    expect(latest!.buildingCumYoyPct).toBeLessThan(15);
    expect(latest!.furnitureMonthCny100m).toBeGreaterThan(100);
    expect(latest!.furnitureMonthCny100m).toBeLessThan(250);
    expect(latest!.furnitureMonthYoyPct).toBeGreaterThan(-15);
    expect(latest!.furnitureMonthYoyPct).toBeLessThan(15);
    expect(latest!.retailMonthYoyPct).toBeGreaterThan(-5);
    expect(latest!.retailMonthYoyPct).toBeLessThan(10);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsRetailTrend(6).length).toBeGreaterThanOrEqual(5);
    expect(shortNbsRetailMonthLabel(latest!.month)).toMatch(/^\d+月$/);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_retail.py"), "utf8");
    expect(script).toContain("建筑及装潢材料类");
    expect(script).toContain("家具类");
    expect(script).toContain("社会消费品零售总额");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(dash).toContain("getLatestNbsRetail");
    expect(dash).toContain("data-nbs-retail");
    expect(dash).toContain("装潢/家具 ≠ 房价");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsRetailFromCSV(
      [
        "month,publish_date,retail_month_cny_100m,retail_month_yoy_pct,retail_cum_cny_100m,retail_cum_yoy_pct,building_month_cny_100m,building_month_yoy_pct,building_cum_cny_100m,building_cum_yoy_pct,furniture_month_cny_100m,furniture_month_yoy_pct,furniture_cum_cny_100m,furniture_cum_yoy_pct,source_url",
        "2099-01,2099-01-01,1,1,1,1,1,1,1,1,1,1,1,1,https://example.com/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});
