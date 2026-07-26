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
    expect(latest!.month).toBe("2026-06");
    expect(latest!.buildingMonthCny100m).toBe(114);
    expect(latest!.buildingMonthYoyPct).toBe(-10.5);
    expect(latest!.buildingCumCny100m).toBe(609);
    expect(latest!.buildingCumYoyPct).toBe(-8.8);
    expect(latest!.furnitureMonthCny100m).toBe(176);
    expect(latest!.furnitureMonthYoyPct).toBe(-6.6);
    expect(latest!.retailMonthYoyPct).toBe(1.0);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsRetailTrend(6).length).toBeGreaterThanOrEqual(5);
    expect(shortNbsRetailMonthLabel("2026-06")).toBe("6月");
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_retail.py"), "utf8");
    expect(script).toContain("建筑及装潢材料类");
    expect(script).toContain("家具类");
    expect(script).toContain("社会消费品零售总额");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
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
