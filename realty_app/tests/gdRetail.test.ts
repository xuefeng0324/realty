import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getGdRetailTrend, getLatestGdRetail, loadGdRetailFromCSV } from "../src/local/gdRetail";

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

    const m15 = getGdRetailTrend(8).find((r) => r.period === "2026_01_05");
    expect(m15).toBeTruthy();
    expect(m15!.retailYoyPct).toBe(0.8);
    expect(m15!.communicationsYoyPct).toBe(23);
  });

  it("爬虫与宏观区域页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_retail.py"), "utf8");
    expect(script).toContain("消费品市场运行简况");
    expect(script).toContain("listed_category_yoy");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(page).toContain("data-gd-retail");
    expect(page).toContain("getLatestGdRetail");
  });

  it("CSV 解析", () => {
    const rows = loadGdRetailFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,retail_total_yi,retail_yoy_pct,urban_yoy_pct,rural_yoy_pct,goods_retail_yoy_pct,catering_yoy_pct,online_retail_yoy_pct,communications_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-07-01,2099-06,100,1.1,1,-0.5,0.2,3,4,5,测试,广东省统计局,https://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.retailTotalYi).toBe(100);
    expect(rows[0]!.communicationsYoyPct).toBe(5);
  });
});
