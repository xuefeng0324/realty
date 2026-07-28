import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdRetailHasHousingRelated,
  getGdRetailTrend,
  getLatestGdRetail,
  loadGdRetailFromCSV
} from "../src/local/gdRetail";

describe("gd retail", () => {
  it("加载广东消费品市场简况（社消零与分项）", () => {
    const latest = getLatestGdRetail();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_H1");
    expect(latest!.retailYoyPct).toBe(1.3);
    expect(latest!.retailTotalYi).toBe(23219.73);
    expect(latest!.communicationsYoyPct).toBe(33.3);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdRetailTrend(3).length).toBeGreaterThanOrEqual(3);

    const m15 = getGdRetailTrend(12).find((r) => r.period === "2026_01_05");
    expect(m15).toBeTruthy();
    expect(m15!.retailYoyPct).toBe(0.8);
    expect(m15!.communicationsYoyPct).toBe(23);

    const q3 = getGdRetailTrend(12).find((r) => r.period === "2025_Q3");
    expect(q3).toBeTruthy();
    expect(q3!.retailTotalYi).toBe(34254.07);
    expect(q3!.retailYoyPct).toBe(2.8);
    expect(q3!.furnitureYoyPct).toBe(63.7);
    expect(q3!.decorationYoyPct).toBe(31.3);
    expect(q3!.communicationsYoyPct).toBe(16.5);
    expect(gdRetailHasHousingRelated(q3!)).toBe(true);
  });

  it("爬虫与宏观区域页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_retail.py"), "utf8");
    expect(script).toContain("消费品市场运行简况");
    expect(script).toContain("listed_category_yoy");
    expect(script).toContain("实现)?社会消费品零售总额");
    expect(script).toContain("furniture_yoy_pct");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(page).toContain("data-gd-retail");
    expect(page).toContain("data-gd-retail-housing");
    expect(page).toContain("getLatestGdRetail");
    const supply = readFileSync(resolve(process.cwd(), "src/pages/supply/supply.vue"), "utf8");
    expect(supply).toContain("data-gz-inventory-nonres-detail");
  });

  it("CSV 解析含家具/装潢", () => {
    const rows = loadGdRetailFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,retail_total_yi,retail_yoy_pct,urban_yoy_pct,rural_yoy_pct,goods_retail_yoy_pct,catering_yoy_pct,online_retail_yoy_pct,communications_yoy_pct,furniture_yoy_pct,decoration_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-07-01,2099-06,100,1.1,1,-0.5,0.2,3,4,5,6,7,测试,广东省统计局,https://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.retailTotalYi).toBe(100);
    expect(rows[0]!.furnitureYoyPct).toBe(6);
    expect(rows[0]!.decorationYoyPct).toBe(7);
  });
});
