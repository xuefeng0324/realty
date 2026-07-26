import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestPbcRegionSf,
  getPbcRegionSf,
  getPbcRegionSfByRegion,
  getPbcRegionSfDeltaVsPrev,
  getPbcRegionSfPeerRanking,
  getPbcRegionSfVsNational,
  listPbcRegionSfVsNational,
  loadPbcRegionSfFromCSV
} from "../src/local/pbcRegionSf";

describe("pbc region social financing (Guangdong)", () => {
  it("加载广东社融增量样本", () => {
    const rows = getPbcRegionSfByRegion("广东");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const latest = getLatestPbcRegionSf();
    expect(latest).not.toBeNull();
    expect(latest!.region).toBe("广东");
    expect(latest!.sfFlowYi).toBeGreaterThan(1000);
    expect(latest!.rmbLoanYi).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/pbc\.gov\.cn/);
  });

  it("含苏浙京沪对照省", () => {
    const all = getPbcRegionSf();
    const regions = new Set(all.map((r) => r.region));
    expect(regions.has("广东")).toBe(true);
    expect(regions.has("江苏") || regions.has("浙江")).toBe(true);
    const peers = getPbcRegionSfPeerRanking();
    expect(peers.length).toBeGreaterThanOrEqual(2);
    expect(peers[0]!.sfFlowYi).toBeGreaterThanOrEqual(peers[peers.length - 1]!.sfFlowYi);
  });

  it("相邻期增量差可算", () => {
    const delta = getPbcRegionSfDeltaVsPrev();
    expect(delta).not.toBeNull();
    expect(typeof delta!.sfFlowDeltaYi).toBe("number");
  });

  it("可与全国社融增量对齐算占比", () => {
    const vs = getPbcRegionSfVsNational();
    expect(vs).not.toBeNull();
    expect(vs!.sharePct).toBeGreaterThan(1);
    expect(vs!.sharePct).toBeLessThan(30);
    expect(vs!.nationalFlowYi).toBeGreaterThan(vs!.region.sfFlowYi);
    expect(listPbcRegionSfVsNational().length).toBeGreaterThanOrEqual(2);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_pbc_region_sf.py"), "utf8");
    expect(script).toContain("地区社会融资");
    expect(script).toContain("PEER_REGIONS");
    expect(script).toContain("≠ 房价");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-pbc-region-sf");
    expect(dash).toContain("getPbcRegionSfPeerRanking");
    expect(dash).toContain("占全国社融");
  });

  it("CSV 解析", () => {
    const rows = loadPbcRegionSfFromCSV(
      [
        "period,label,region,sf_flow_yi,rmb_loan_yi,corp_bond_yi,gov_bond_yi,equity_yi,source_url,xlsx_url",
        "2099-03,2099年一季度,广东,10000,7000,500,2000,100,http://www.pbc.gov.cn/a,http://www.pbc.gov.cn/a.xlsx",
        "2099-03,2099年一季度,江苏,9000,6000,400,1800,80,http://www.pbc.gov.cn/a,http://www.pbc.gov.cn/a.xlsx",
        "2099-06,2099年上半年,广东,15000,11000,800,2700,200,http://www.pbc.gov.cn/b,http://www.pbc.gov.cn/b.xlsx"
      ].join("\n")
    );
    expect(rows.filter((r) => r.period === "2099-03").length).toBe(2);
    expect(rows.find((r) => r.region === "江苏")!.sfFlowYi).toBe(9000);
  });
});
