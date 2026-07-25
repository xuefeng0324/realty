import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzLandDeals,
  getLatestGzLandDeals,
  landSurfaceUnitPriceYuan,
  loadGzLandDealsFromCSV,
  summarizeGzLandDeals,
  summarizeGzLandDealsByMonth
} from "../src/local/gzLandDeals";

describe("gz residential land deals", () => {
  it("加载广州居住用地成交样本（扩大历史）", () => {
    const rows = getGzLandDeals();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((r) => r.city === "广州")).toBe(true);
    expect(rows.every((r) => /居住|住宅|R2|安置/.test(r.landUse))).toBe(true);
    expect(rows[0]!.sourceUrl).toMatch(/ghzyj\.gz\.gov\.cn/);
    expect(rows[rows.length - 1]!.dealDate <= rows[0]!.dealDate).toBe(true);
    const sum = summarizeGzLandDeals();
    expect(sum).not.toBeNull();
    expect(sum!.count).toBe(rows.length);
    expect(sum!.totalPriceWan).toBeGreaterThan(0);
  });

  it("地表单价 = 成交价万元×10000/面积", () => {
    const d = getLatestGzLandDeals(1)[0]!;
    const unit = landSurfaceUnitPriceYuan(d)!;
    expect(unit).toBeCloseTo((d.priceWan * 10000) / d.areaSqm, 5);
  });

  it("爬虫默认扩页；用途字段门禁；仪表盘有卡与分月汇总", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_land_deals.py"), "utf8");
    expect(script).toContain("ghzyj.gz.gov.cn");
    expect(script).toContain("RESIDENTIAL_RE");
    expect(script).toContain("NamedTemporaryFile");
    expect(script).toContain("default=12");
    expect(script).toContain("必须用途字段命中");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-gz-land-deals");
    expect(dash).toContain("getLatestGzLandDeals");
    expect(dash).toContain("summarizeGzLandDealsByMonth");
    expect(dash).toContain("gzLandByMonth");
  });

  it("分月汇总按成交月聚合", () => {
    const months = summarizeGzLandDealsByMonth(12);
    expect(months.length).toBeGreaterThan(0);
    expect(months.every((m) => /^\d{4}-\d{2}$/.test(m.month))).toBe(true);
    expect(months.every((m) => m.count > 0)).toBe(true);
    if (months.length >= 2) {
      expect(months[0]!.month >= months[1]!.month).toBe(true);
    }
  });

  it("CSV 解析", () => {
    const rows = loadGzLandDealsFromCSV(
      [
        "city,deal_date,publish_date,district,location,land_use,area_sqm,price_wan,buyer,source_org,source_url",
        "广州,2099-01-01,2099-01-02,天河区,测试地块,二类居住用地（R2）,1000,500,测试公司,广州市规划和自然资源局,https://ghzyj.gz.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.priceWan).toBe(500);
  });
});

describe("adversarial city sync for stats70/wangqian/listing-filter", () => {
  it("P1: 网签/70城/性价比不得只靠异步 cities.value", () => {
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("cityNameForId(app.cityId)");
    expect(dash).not.toMatch(
      /currentWangqianCityName[\s\S]{0,200}cities\.value\.find\(\(c\) => c\.city_id === app\.cityId\)/
    );
    expect(dash).not.toMatch(
      /stats70CurrentCityRank[\s\S]{0,200}cities\.value\.find\(\(c\) => c\.city_id === app\.cityId\)/
    );
    expect(dash).toContain("store.getCityById(app.cityId)?.cityName");
    const filter = readFileSync(resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"), "utf8");
    expect(filter).toContain("syncCityName");
    expect(filter).toContain("store.getCityById(app.cityId)");
    expect(filter).not.toMatch(
      /paretoPriceCapWan[\s\S]{0,180}cities\.value\.find\(\(c\) => c\.city_id === app\.cityId\)\?\.city_name/
    );
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(school).toContain("store.getCityById(app.cityId)?.cityName");
  });
});
