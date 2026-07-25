import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getLatestNbsRealEstate, loadNbsRealEstateFromCSV } from "../src/local/nbsRealEstate";

describe("国家统计局房地产市场数据", () => {
  it("加载官方内置快照并校验关键指标", () => {
    const csv = readFileSync(resolve(process.cwd(), "static/nbs_real_estate.csv"), "utf8");
    const rows = loadNbsRealEstateFromCSV(csv);
    const latest = getLatestNbsRealEstate();

    expect(rows.length).toBeGreaterThan(0);
    expect(latest?.publishDate).toBe("2026-07-15");
    expect(latest?.investmentCny100m).toBe(38074);
    expect(latest?.salesArea10kSqm).toBe(40140);
    expect(latest?.salesAmountCny100m).toBe(37945);
    expect(latest?.inventoryArea10kSqm).toBe(76315);
    expect(latest?.sourceUrl).toBe("https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964126.html");
  });

  it("拒绝非国家统计局来源", () => {
    expect(() => loadNbsRealEstateFromCSV([
      "period,publish_date,investment_cny_100m,investment_yoy_pct,sales_area_10k_sqm,sales_area_yoy_pct,sales_amount_cny_100m,sales_amount_yoy_pct,inventory_area_10k_sqm,inventory_area_yoy_pct,funds_cny_100m,funds_yoy_pct,source_url",
      "2026-01_to_2026-06,2026-07-15,1,1,1,1,1,1,1,1,1,1,https://example.com"
    ].join("\n"))).toThrow(/来源链接无效/);
  });
});
