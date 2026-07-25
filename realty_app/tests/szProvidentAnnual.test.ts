import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractToDepositPct,
  getLatestSzProvidentAnnual,
  getSzProvidentAnnualRows,
  getSzProvidentYearDelta,
  loadSzProvidentAnnualFromCSV,
  loanToDepositBalancePct
} from "../src/local/szProvidentAnnual";

describe("sz provident annual", () => {
  it("加载深圳公积金年报摘要", () => {
    const rows = getSzProvidentAnnualRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const latest = getLatestSzProvidentAnnual();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2025);
    expect(latest!.loanIssuedWan).toBe(4.14);
    expect(latest!.loanIssuedYi).toBe(489.03);
    expect(latest!.loanBalanceYi).toBe(2561.75);
    expect(latest!.depositBalanceYi).toBe(3388.05);
    expect(latest!.supportPurchaseWanSqm).toBe(367.56);
    expect(latest!.sourceUrl).toMatch(/zjj\.sz\.gov\.cn/);
    expect(extractToDepositPct(latest)).toBe(91.1);
    expect(loanToDepositBalancePct(latest)).toBe(75.6);
    const y2024 = rows.find((r) => r.year === 2024);
    expect(y2024).toBeTruthy();
    expect(y2024!.depositAmountYi).toBe(1227.15);
    expect(y2024!.loanIssuedYi).toBe(382.34);
    const delta = getSzProvidentYearDelta(latest);
    expect(delta).not.toBeNull();
    expect(delta!.prior.year).toBe(2024);
    expect(delta!.depositDeltaYi).toBe(73.8);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_sz_provident_annual.py"), "utf8");
    expect(script).toContain("住房公积金");
    expect(script).toContain("年度报告");
    expect(script).toContain("pubdata/qtsj");
    expect(script).toContain("load_existing");
    const lpr = readFileSync(resolve(process.cwd(), "scripts/crawl_lpr_history.py"), "utf8");
    expect(lpr).toContain("pbc.gov.cn");
    expect(lpr).toContain("1年期LPR");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestSzProvidentAnnual");
    expect(dash).toContain("data-sz-provident-annual");
    expect(dash).toContain("data-sz-provident-yoy");
  });

  it("CSV 解析", () => {
    const rows = loadSzProvidentAnnualFromCSV(
      [
        "city,year,publish_date,paid_units_wan,paid_persons_wan,deposit_amount_yi,deposit_balance_yi,extract_amount_yi,loan_issued_wan,loan_issued_yi,loan_balance_yi,support_purchase_wan_sqm,public_rental_supplement_yi,title,source_org,source_url",
        "深圳,2099,2099-01-01,1,2,3,4,5,6,7,8,9,10,测试,深圳市住房公积金管理中心,https://zjj.sz.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.loanIssuedWan).toBe(6);
  });
});
