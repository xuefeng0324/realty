import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzProvidentAnnualRows,
  getLatestGzProvidentAnnual,
  gzExtractToDepositPct,
  gzLoanToDepositBalancePct,
  loadGzProvidentAnnualFromCSV
} from "../src/local/gzProvidentAnnual";

describe("gz provident annual", () => {
  it("加载广州公积金年报摘要", () => {
    const rows = getGzProvidentAnnualRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const latest = getLatestGzProvidentAnnual();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2024);
    expect(latest!.loanIssuedWan).toBe(3.87);
    expect(latest!.loanIssuedYi).toBe(306.89);
    expect(latest!.loanBalanceYi).toBe(2233.93);
    expect(latest!.depositBalanceYi).toBe(3058.97);
    expect(latest!.supportPurchaseWanSqm).toBe(369.7);
    expect(latest!.sourceUrl).toMatch(/gjj\.gz\.gov\.cn/);
    expect(gzExtractToDepositPct(latest)).toBe(86.3);
    expect(gzLoanToDepositBalancePct(latest)).toBe(73.0);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_provident_annual.py"), "utf8");
    expect(script).toContain("住房公积金");
    expect(script).toContain("年度报告");
    expect(script).toContain("gjj.gz.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGzProvidentAnnual");
    expect(dash).toContain("data-gz-provident-annual");
    expect(dash).toContain("data-nbs-series-toggle");
  });

  it("CSV 解析", () => {
    const rows = loadGzProvidentAnnualFromCSV(
      [
        "city,year,publish_date,paid_units_wan,paid_persons_wan,deposit_amount_yi,deposit_balance_yi,extract_amount_yi,loan_issued_wan,loan_issued_yi,loan_balance_yi,support_purchase_wan_sqm,public_rental_supplement_yi,title,source_org,source_url",
        "广州,2099,2099-01-01,1,2,3,4,5,6,7,8,9,10,测试,广州住房公积金管理中心,https://gjj.gz.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.loanIssuedWan).toBe(6);
  });
});
