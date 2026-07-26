import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsRealEstate,
  getNbsImpliedContractUnitPrice,
  getNbsImpliedResidentialUnitPrice,
  getNbsImpliedInventoryMonths,
  getNbsImpliedInventoryMonthsTrend,
  getNbsImpliedUnitPriceTrend,
  getNbsRealEstateHistory,
  getNbsYoyTrend,
  loadNbsRealEstateFromCSV
} from "../src/local/nbsRealEstate";

const stubBase = {
  period: "2026-01_to_2026-06",
  publishDate: "2026-01-01",
  investmentCny100m: 1,
  investmentYoyPct: 0,
  residentialInvestmentCny100m: 1,
  residentialInvestmentYoyPct: 0,
  constructionArea10kSqm: 1,
  constructionAreaYoyPct: 0,
  newStartsArea10kSqm: 1,
  newStartsAreaYoyPct: 0,
  completedArea10kSqm: 1,
  completedAreaYoyPct: 0,
  salesArea10kSqm: 0,
  salesAreaYoyPct: 0,
  residentialSalesArea10kSqm: 0,
  residentialSalesAreaYoyPct: 0,
  salesAmountCny100m: 100,
  salesAmountYoyPct: 0,
  residentialSalesAmountCny100m: 100,
  residentialSalesAmountYoyPct: 0,
  inventoryArea10kSqm: 10,
  inventoryAreaYoyPct: 0,
  residentialInventoryArea10kSqm: 10,
  residentialInventoryAreaYoyPct: 0,
  fundsCny100m: 1,
  fundsYoyPct: 0,
  mortgageFundsCny100m: 1,
  mortgageFundsYoyPct: 0,
  sourceUrl: "https://www.stats.gov.cn/x"
};

describe("国家统计局房地产市场数据", () => {
  it("加载多期官方快照并校验最新一期", () => {
    const csv = readFileSync(resolve(process.cwd(), "static/nbs_real_estate.csv"), "utf8");
    const rows = loadNbsRealEstateFromCSV(csv);
    const latest = getLatestNbsRealEstate();

    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(latest?.publishDate).toBe("2026-07-15");
    expect(latest?.period).toBe("2026-01_to_2026-06");
    expect(latest?.investmentCny100m).toBe(38074);
    expect(latest?.residentialInvestmentCny100m).toBe(29300);
    expect(latest?.residentialInvestmentYoyPct).toBe(-17.8);
    expect(latest?.constructionArea10kSqm).toBe(554049);
    expect(latest?.constructionAreaYoyPct).toBe(-12.5);
    expect(latest?.newStartsArea10kSqm).toBe(23239);
    expect(latest?.newStartsAreaYoyPct).toBe(-23.4);
    expect(latest?.completedArea10kSqm).toBe(17221);
    expect(latest?.completedAreaYoyPct).toBe(-23.7);
    expect(latest?.salesArea10kSqm).toBe(40140);
    expect(latest?.residentialSalesArea10kSqm).toBe(33318);
    expect(latest?.residentialSalesAreaYoyPct).toBe(-12.4);
    expect(latest?.salesAmountCny100m).toBe(37945);
    expect(latest?.residentialSalesAmountCny100m).toBe(33270);
    expect(latest?.residentialSalesAmountYoyPct).toBe(-13.7);
    expect(latest?.inventoryArea10kSqm).toBe(76315);
    expect(latest?.residentialInventoryArea10kSqm).toBe(40865);
    expect(latest?.mortgageFundsCny100m).toBe(5137);
    expect(latest?.mortgageFundsYoyPct).toBe(-24.9);
    expect(latest?.sourceUrl).toBe("https://www.stats.gov.cn/sj/zxfb/202607/t20260715_1964126.html");

    const history = getNbsRealEstateHistory();
    expect(history.map((x) => x.period)).toEqual([
      "2026-01_to_2026-06",
      "2026-01_to_2026-05",
      "2026-01_to_2026-04",
      "2026-01_to_2026-03",
      "2026-01_to_2026-02"
    ]);

    const trend = getNbsYoyTrend();
    expect(trend.map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);
    expect(trend[0].salesAreaYoyPct).toBe(-13.5);
    expect(trend[4].salesAreaYoyPct).toBe(-11.6);
    expect(trend.map((x) => x.constructionAreaYoyPct)).toEqual([-11.7, -11.7, -12.1, -12.3, -12.5]);
    expect(trend.map((x) => x.newStartsAreaYoyPct)).toEqual([-23.1, -20.3, -22.0, -22.6, -23.4]);
    expect(trend.map((x) => x.completedAreaYoyPct)).toEqual([-27.9, -25.0, -24.0, -23.4, -23.7]);
    expect(trend.map((x) => x.residentialSalesAreaYoyPct)).toEqual([-15.9, -13.1, -12.2, -12.1, -12.4]);
    expect(trend.map((x) => x.mortgageFundsYoyPct)).toEqual([-41.9, -34.6, -31.7, -28.0, -24.9]);

    // 37945 亿元 / 40140 万㎡ → 约 9453 元/㎡（合同派生，非城市均价）
    expect(getNbsImpliedContractUnitPrice(latest)).toBe(9453);
    expect(getNbsImpliedContractUnitPrice()).toBe(9453);
    // 33270 / 33318 → 约 9986 元/㎡ 住宅合同派生
    expect(getNbsImpliedResidentialUnitPrice(latest)).toBe(9986);
    // 76315 × 6 / 40140 ≈ 11.4 个月（宏观粗算，非城市去化）
    expect(getNbsImpliedInventoryMonths(latest)).toBe(11.4);

    const priceTrend = getNbsImpliedUnitPriceTrend();
    expect(priceTrend.map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);
    expect(priceTrend.map((x) => x.unitPriceYuanPerSqm)).toEqual([8809, 8841, 9106, 9376, 9453]);

    const monthsTrend = getNbsImpliedInventoryMonthsTrend();
    expect(monthsTrend.map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);
    expect(monthsTrend.map((x) => x.inventoryMonths)).toEqual([17.2, 12.1, 12.3, 12.3, 11.4]);
    expect(trend.map((x) => x.fundsYoyPct)).toEqual([-16.5, -17.3, -18.4, -19.0, -20.2]);

    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-nbs-pipeline");
    expect(dash).toContain("data-nbs-residential");
    expect(dash).toContain("constructionArea10kSqm");
    expect(dash).toContain("mortgageFundsCny100m");
  });

  it("合同均价在面积为 0 时返回 null", () => {
    expect(getNbsImpliedContractUnitPrice({ ...stubBase, salesArea10kSqm: 0 })).toBeNull();
    expect(getNbsImpliedResidentialUnitPrice({ ...stubBase, residentialSalesArea10kSqm: 0 })).toBeNull();
    expect(getNbsImpliedInventoryMonths({ ...stubBase, salesArea10kSqm: 0 })).toBeNull();
  });

  it("拒绝非国家统计局来源", () => {
    expect(() =>
      loadNbsRealEstateFromCSV(
        [
          "period,publish_date,investment_cny_100m,investment_yoy_pct,residential_investment_cny_100m,residential_investment_yoy_pct,construction_area_10k_sqm,construction_area_yoy_pct,new_starts_area_10k_sqm,new_starts_area_yoy_pct,completed_area_10k_sqm,completed_area_yoy_pct,sales_area_10k_sqm,sales_area_yoy_pct,residential_sales_area_10k_sqm,residential_sales_area_yoy_pct,sales_amount_cny_100m,sales_amount_yoy_pct,residential_sales_amount_cny_100m,residential_sales_amount_yoy_pct,inventory_area_10k_sqm,inventory_area_yoy_pct,residential_inventory_area_10k_sqm,residential_inventory_area_yoy_pct,funds_cny_100m,funds_yoy_pct,mortgage_funds_cny_100m,mortgage_funds_yoy_pct,source_url",
          "2026-01_to_2026-06,2026-07-15,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,https://example.com"
        ].join("\n")
      )
    ).toThrow(/来源链接无效/);
  });
});
