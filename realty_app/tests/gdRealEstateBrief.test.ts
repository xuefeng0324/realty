import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdBriefImpliedUnitPrice,
  getGdRealEstateBriefRows,
  getLatestGdRealEstateBrief,
  loadGdRealEstateBriefFromCSV
} from "../src/local/gdRealEstateBrief";

describe("gd real estate brief", () => {
  it("加载广东房地产运行简况", () => {
    const rows = getGdRealEstateBriefRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const latest = getLatestGdRealEstateBrief();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_Q1");
    expect(latest!.salesAreaWanSqm).toBe(1313.34);
    expect(latest!.investmentYi).toBe(1866.08);
    expect(latest!.sourceUrl).toMatch(/zfcxjst\.gd\.gov\.cn/);
    const y2025 = rows.find((r) => r.period === "2025");
    expect(y2025).toBeTruthy();
    expect(y2025!.salesAmountYi).toBe(9720.13);
    expect(gdBriefImpliedUnitPrice(y2025!)).toBe(15666);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_real_estate_brief.py"), "utf8");
    expect(script).toContain("房地产市场运行简况");
    expect(script).toContain("zfcxjst.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGdRealEstateBrief");
    expect(dash).toContain("data-gd-real-estate-brief");
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
