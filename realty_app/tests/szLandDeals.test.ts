import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSzLandDeals,
  getSzLandDeals,
  landStartSurfaceUnitPriceYuan,
  loadSzLandDealsFromCSV,
  summarizeSzLandDeals,
  summarizeSzLandDealsByMonth
} from "../src/local/szLandDeals";

describe("sz residential land deals", () => {
  it("加载深圳居住用地已成交样本（起始价）", () => {
    const rows = getSzLandDeals();
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.every((r) => r.city === "深圳")).toBe(true);
    expect(rows.every((r) => /居住|住宅|R2|安置/.test(r.landUse))).toBe(true);
    expect(rows.every((r) => r.startPriceWan > 0 && r.areaSqm > 0)).toBe(true);
    expect(rows[0]!.sourceUrl).toMatch(/szggzy\.com/);
    const sum = summarizeSzLandDeals();
    expect(sum).not.toBeNull();
    expect(sum!.count).toBe(rows.length);
    expect(sum!.totalStartPriceWan).toBeGreaterThan(0);
    expect(sum!.latestDate >= "2025-01-01").toBe(true);
    expect(sum!.avgStartSurfaceUnitPriceYuan).not.toBeNull();
    expect(sum!.avgStartSurfaceUnitPriceYuan!).toBeCloseTo(
      (sum!.totalStartPriceWan * 10000) / sum!.totalAreaSqm,
      5
    );
  });

  it("地表单价 = 起始价万元×10000/面积", () => {
    const d = getLatestSzLandDeals(1)[0]!;
    const unit = landStartSurfaceUnitPriceYuan(d)!;
    expect(unit).toBeCloseTo((d.startPriceWan * 10000) / d.areaSqm, 5);
  });

  it("爬虫 pageNum 从 0；用途居住；仪表盘有卡", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_sz_land_deals.py"), "utf8");
    expect(script).toContain("szggzy.com/cms/api/v1/trade/content/tk-notice/land-list");
    expect(script).toContain('landUseLike": "居住"');
    expect(script).toContain("pageNum 从 0");
    expect(script).toContain("start_price_wan");
    expect(script).toContain("NamedTemporaryFile");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-sz-land-deals");
    expect(dash).toContain("样本起始均价");
    expect(dash).toContain("avgStartSurfaceUnitPriceYuan");
    expect(dash).toContain("summarizeSzLandDealsByMonth");
    expect(dash).toContain("起始价");
  });

  it("分月汇总", () => {
    const months = summarizeSzLandDealsByMonth(12);
    expect(months.length).toBeGreaterThan(0);
    expect(months.every((m) => /^\d{4}-\d{2}$/.test(m.month))).toBe(true);
    expect(
      months.every(
        (m) =>
          m.avgStartSurfaceUnitPriceYuan == null ||
          Math.abs(m.avgStartSurfaceUnitPriceYuan - (m.totalStartPriceWan * 10000) / m.totalAreaSqm) <
            1e-6
      )
    ).toBe(true);
  });

  it("CSV 解析", () => {
    const rows = loadSzLandDealsFromCSV(
      [
        "city,publish_date,deal_status,district,location,land_use,area_sqm,start_price_wan,land_no,package_code,source_org,source_url",
        "深圳,2099-01-01,已成交,南山区,测试,一类居住用地,1000,500,A1,PKG,深圳公共资源交易中心,https://szggzy.com/a"
      ].join("\n")
    );
    expect(rows[0]!.startPriceWan).toBe(500);
  });
});
