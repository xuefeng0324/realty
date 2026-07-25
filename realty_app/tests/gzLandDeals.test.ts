import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzLandDeals,
  getLatestGzLandDeals,
  landSurfaceUnitPriceYuan,
  loadGzLandDealsFromCSV,
  summarizeGzLandDeals
} from "../src/local/gzLandDeals";

describe("gz residential land deals", () => {
  it("加载广州居住用地成交样本", () => {
    const rows = getGzLandDeals();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.city === "广州")).toBe(true);
    expect(rows.every((r) => /居住|住宅|R2/.test(r.landUse))).toBe(true);
    expect(rows[0]!.sourceUrl).toMatch(/ghzyj\.gz\.gov\.cn/);
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

  it("爬虫仅认居住用途；仪表盘有卡", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_land_deals.py"), "utf8");
    expect(script).toContain("ghzyj.gz.gov.cn");
    expect(script).toContain("RESIDENTIAL_RE");
    expect(script).toContain("NamedTemporaryFile");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-gz-land-deals");
    expect(dash).toContain("getLatestGzLandDeals");
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
    const filter = readFileSync(resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"), "utf8");
    expect(filter).toContain("syncCityName");
    expect(filter).toContain("store.getCityById(app.cityId)");
    expect(filter).not.toMatch(
      /paretoPriceCapWan[\s\S]{0,180}cities\.value\.find\(\(c\) => c\.city_id === app\.cityId\)\?\.city_name/
    );
  });
});
