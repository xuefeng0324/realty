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
  getNbsResidentialConstructionSharePct,
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
  residentialConstructionArea10kSqm: 1,
  residentialConstructionAreaYoyPct: 0,
  newStartsArea10kSqm: 1,
  newStartsAreaYoyPct: 0,
  residentialNewStartsArea10kSqm: 1,
  residentialNewStartsAreaYoyPct: 0,
  completedArea10kSqm: 1,
  completedAreaYoyPct: 0,
  residentialCompletedArea10kSqm: 1,
  residentialCompletedAreaYoyPct: 0,
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
  domesticLoanFundsCny100m: 1,
  domesticLoanFundsYoyPct: 0,
  depositFundsCny100m: 1,
  depositFundsYoyPct: 0,
  mortgageFundsCny100m: 1,
  mortgageFundsYoyPct: 0,
  selfRaisedFundsCny100m: 1,
  selfRaisedFundsYoyPct: 0,
  sourceUrl: "https://www.stats.gov.cn/x"
};

const HEADER =
  "period,publish_date,investment_cny_100m,investment_yoy_pct,residential_investment_cny_100m,residential_investment_yoy_pct,construction_area_10k_sqm,construction_area_yoy_pct,residential_construction_area_10k_sqm,residential_construction_area_yoy_pct,new_starts_area_10k_sqm,new_starts_area_yoy_pct,residential_new_starts_area_10k_sqm,residential_new_starts_area_yoy_pct,completed_area_10k_sqm,completed_area_yoy_pct,residential_completed_area_10k_sqm,residential_completed_area_yoy_pct,sales_area_10k_sqm,sales_area_yoy_pct,residential_sales_area_10k_sqm,residential_sales_area_yoy_pct,sales_amount_cny_100m,sales_amount_yoy_pct,residential_sales_amount_cny_100m,residential_sales_amount_yoy_pct,inventory_area_10k_sqm,inventory_area_yoy_pct,residential_inventory_area_10k_sqm,residential_inventory_area_yoy_pct,funds_cny_100m,funds_yoy_pct,domestic_loan_funds_cny_100m,domestic_loan_funds_yoy_pct,deposit_funds_cny_100m,deposit_funds_yoy_pct,mortgage_funds_cny_100m,mortgage_funds_yoy_pct,self_raised_funds_cny_100m,self_raised_funds_yoy_pct,source_url";

describe("国家统计局房地产市场数据", () => {
  it("加载多期官方快照并校验最新一期", () => {
    const csv = readFileSync(resolve(process.cwd(), "static/nbs_real_estate.csv"), "utf8");
    const rows = loadNbsRealEstateFromCSV(csv);
    const latest = getLatestNbsRealEstate();

    expect(rows.length).toBeGreaterThanOrEqual(5);
    // v1.122.12：cron 每月自动补最新累计期，断言改为「2026 年内累计期 + 数值合理」
    // 即可，不再硬编码 publishDate / period / 各分项数值（分项数随月变化）。
    expect(latest?.period).toMatch(/^2026-\d{2}_to_2026-\d{2}$/);
    expect(latest?.publishDate).toMatch(/^2026-\d{2}-\d{2}$/);
    expect(latest?.investmentCny100m).toBeGreaterThan(10000);
    expect(latest?.investmentCny100m).toBeLessThan(100000);
    expect(latest?.residentialInvestmentYoyPct).toBeGreaterThan(-30);
    expect(latest?.residentialInvestmentYoyPct).toBeLessThan(10);
    expect(latest?.salesAmountCny100m).toBeGreaterThan(10000);
    expect(latest?.salesAmountCny100m).toBeLessThan(80000);
    expect(latest?.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsResidentialConstructionSharePct(latest)).toBe(69.4);

    const history = getNbsRealEstateHistory();
    // v1.122.12：cron 每月自动追加最新累计期，断言改为「最新一期 publishDate 合理」
    // 即可（history 是按 publishDate 降序，最新在 [0]）。
    expect(history.length).toBeGreaterThanOrEqual(5);
    expect(history.every((x) => x.period.startsWith("2026-"))).toBe(true);
    expect(history[0]?.period).toMatch(/^2026-\d{2}_to_2026-\d{2}$/);

    const trend = getNbsYoyTrend();
    // v1.122.12：cron 每月自动追加最新累计期，trend 长度随 CSV 变化。
    // 断言改为「trend 头 5 个标签是 1-2 ~ 1-6 顺序」即可，不再硬编码每行数值。
    expect(trend.length).toBeGreaterThanOrEqual(5);
    expect(trend.slice(0, 5).map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);

    // 37945 亿元 / 40140 万㎡ → 约 9453 元/㎡（合同派生，非城市均价）
    expect(getNbsImpliedContractUnitPrice(latest)).toBeGreaterThan(5000);
    expect(getNbsImpliedContractUnitPrice(latest)).toBeLessThan(15000);
    expect(getNbsImpliedContractUnitPrice()).toBeGreaterThan(5000);
    // 33270 / 33318 → 约 9986 元/㎡ 住宅合同派生
    expect(getNbsImpliedResidentialUnitPrice(latest)).toBeGreaterThan(5000);
    expect(getNbsImpliedResidentialUnitPrice(latest)).toBeLessThan(15000);
    // 76315 × 6 / 40140 ≈ 11.4 个月（宏观粗算，非城市去化）
    expect(getNbsImpliedInventoryMonths(latest)).toBeGreaterThan(8);
    expect(getNbsImpliedInventoryMonths(latest)).toBeLessThan(20);

    const priceTrend = getNbsImpliedUnitPriceTrend();
    expect(priceTrend.length).toBeGreaterThanOrEqual(5);
    expect(priceTrend.slice(0, 5).map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);
    expect(priceTrend[0].unitPriceYuanPerSqm).toBeGreaterThan(5000);
    expect(priceTrend[0].unitPriceYuanPerSqm).toBeLessThan(15000);

    const monthsTrend = getNbsImpliedInventoryMonthsTrend();
    expect(monthsTrend.length).toBeGreaterThanOrEqual(5);
    expect(monthsTrend.slice(0, 5).map((x) => x.shortLabel)).toEqual(["1—2", "1—3", "1—4", "1—5", "1—6"]);
    expect(monthsTrend[0].inventoryMonths).toBeGreaterThan(8);
    expect(monthsTrend[0].inventoryMonths).toBeLessThan(25);

    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-nbs-pipeline");
    expect(dash).toContain("data-nbs-res-pipeline");
    expect(dash).toContain("data-nbs-residential");
    expect(dash).toContain("data-nbs-funds");
    expect(dash).toContain("residentialConstructionArea10kSqm");
    expect(dash).toContain("depositFundsCny100m");
    expect(dash).toContain("domesticLoanFundsCny100m");
  });

  it("合同均价在面积为 0 时返回 null", () => {
    expect(getNbsImpliedContractUnitPrice({ ...stubBase, salesArea10kSqm: 0 })).toBeNull();
    expect(getNbsImpliedResidentialUnitPrice({ ...stubBase, residentialSalesArea10kSqm: 0 })).toBeNull();
    expect(getNbsImpliedInventoryMonths({ ...stubBase, salesArea10kSqm: 0 })).toBeNull();
    expect(getNbsResidentialConstructionSharePct({ ...stubBase, constructionArea10kSqm: 0 })).toBeNull();
  });

  it("拒绝非国家统计局来源", () => {
    const ones = Array.from({ length: 40 }, () => "1").join(",");
    expect(() =>
      loadNbsRealEstateFromCSV([HEADER, `2026-01_to_2026-06,2026-07-15,${ones},https://example.com`].join("\n"))
    ).toThrow(/来源链接无效/);
  });
});
