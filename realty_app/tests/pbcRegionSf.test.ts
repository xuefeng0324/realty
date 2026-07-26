import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestPbcRegionSf,
  getPbcRegionSf,
  getPbcRegionSfDeltaVsPrev,
  loadPbcRegionSfFromCSV
} from "../src/local/pbcRegionSf";

describe("pbc region social financing (Guangdong)", () => {
  it("加载广东社融增量样本", () => {
    const rows = getPbcRegionSf();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const latest = getLatestPbcRegionSf();
    expect(latest).not.toBeNull();
    expect(latest!.region).toBe("广东");
    expect(latest!.sfFlowYi).toBeGreaterThan(1000);
    expect(latest!.rmbLoanYi).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/pbc\.gov\.cn/);
  });

  it("相邻期增量差可算", () => {
    const delta = getPbcRegionSfDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.sfFlowDeltaYi).toBe("number");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_pbc_region_sf.py"), "utf8");
    expect(script).toContain("地区社会融资");
    expect(script).toContain("sf_flow_yi");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-pbc-region-sf");
    expect(dash).toContain("getLatestPbcRegionSf");
  });

  it("CSV 解析", () => {
    const rows = loadPbcRegionSfFromCSV(
      [
        "period,label,region,sf_flow_yi,rmb_loan_yi,corp_bond_yi,gov_bond_yi,equity_yi,source_url,xlsx_url",
        "2099-03,2099年一季度,广东,10000,7000,500,2000,100,http://www.pbc.gov.cn/a,http://www.pbc.gov.cn/a.xlsx",
        "2099-06,2099年上半年,广东,15000,11000,800,2700,200,http://www.pbc.gov.cn/b,http://www.pbc.gov.cn/b.xlsx"
      ].join("\n")
    );
    expect(rows[0]!.period).toBe("2099-06");
    expect(rows[0]!.sfFlowYi).toBe(15000);
  });
});
