import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdBriefImpliedUnitPrice,
  getGdRealEstateBriefRows,
  getGdRealEstateBriefTrend,
  getLatestGdRealEstateBrief,
  loadGdRealEstateBriefFromCSV
} from "../src/local/gdRealEstateBrief";

describe("gd real estate brief", () => {
  it("加载广东房地产运行简况多期", () => {
    const rows = getGdRealEstateBriefRows();
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const latest = getLatestGdRealEstateBrief();
    expect(latest).not.toBeNull();
    // 期次随官方发布推进（H1/1-8月/前三季度…），只校验形状，不锁死具体期次
    expect(latest!.period).toMatch(/^20\d{2}_(H1|Q[1-4]|0\d_\d{2})$/);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn|zfcxjst\.gd\.gov\.cn/);
    // 固定期次数值断言（1-8月只披露投资额；销售面积在 1-7月 一期）
    const m18 = rows.find((r) => r.period === "2026_01_08");
    expect(m18).toBeTruthy();
    expect(m18!.investmentYi).toBeCloseTo(5000.51, 1);
    const m17 = rows.find((r) => r.period === "2026_01_07");
    expect(m17).toBeTruthy();
    expect(m17!.salesAreaWanSqm).toBeCloseTo(3184.09, 1);
    expect(m17!.investmentYi).toBeCloseTo(4469.79, 1);
    const y2025 = rows.find((r) => r.period === "2025");
    expect(y2025).toBeTruthy();
    expect(y2025!.salesAmountYi).toBe(9720.13);
    expect(gdBriefImpliedUnitPrice(y2025!)).toBe(15666);
    const q1 = rows.find((r) => r.period === "2025_Q1");
    expect(q1!.salesAreaWanSqm).toBe(1556.33);
    expect(rows.find((r) => r.period === "2026_01_05")!.salesAreaWanSqm).toBe(2189.6);
    // trend 按 sort_key 降序：只校验排序稳定，不锁死具体期次
    const trend3 = getGdRealEstateBriefTrend(3);
    expect(trend3.length).toBe(3);
    expect(trend3[0]!.sortKey >= trend3[1]!.sortKey).toBe(true);
    expect(trend3[1]!.sortKey >= trend3[2]!.sortKey).toBe(true);
    expect(trend3[0]!.period).toBe(latest!.period);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_real_estate_brief.py"), "utf8");
    expect(script).toContain("房地产市场运行简况");
    expect(script).toContain("zfcxjst.gd.gov.cn");
    expect(script).toContain("stats.gd.gov.cn");
    expect(script).toContain("STATS_LIST_URL");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(dash).toContain("getLatestGdRealEstateBrief");
    expect(dash).toContain("data-gd-real-estate-brief");
    expect(dash).toContain("data-gd-brief-series-toggle");
    expect(dash).toContain("gdBriefSeriesExpanded");
  });

  it("CSV 解析", () => {
    const rows = loadGdRealEstateBriefFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,investment_yi,investment_yoy_pct,residential_investment_yi,sales_area_wan_sqm,sales_area_yoy_pct,residential_sales_area_wan_sqm,sales_amount_yi,sales_amount_yoy_pct,residential_sales_amount_yi,construction_area_wan_sqm,completed_area_wan_sqm,pr_sales_area_wan_sqm,pr_investment_yi,title,source_org,source_url",
        "广东,2099_Q1,2099年一季度,2099-01-01,2099-03,1,-1,2,3,-2,4,5,-3,6,7,8,9,10,测试,广东省住房和城乡建设厅,https://zfcxjst.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.salesAreaWanSqm).toBe(3);
  });
});
