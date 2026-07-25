import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdExtractToDepositPct,
  gdLoanToDepositBalancePct,
  getLatestGdProvidentAnnual,
  getGdProvidentAnnualRows,
  loadGdProvidentAnnualFromCSV
} from "../src/local/gdProvidentAnnual";

describe("gd provident annual", () => {
  it("加载广东省公积金年报摘要", () => {
    const rows = getGdProvidentAnnualRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const latest = getLatestGdProvidentAnnual();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2024);
    expect(latest!.depositAmountYi).toBe(4088.55);
    expect(latest!.depositBalanceYi).toBe(10397.66);
    expect(latest!.loanIssuedWan).toBe(15.23);
    expect(latest!.loanIssuedYi).toBe(1017.02);
    expect(latest!.extractAmountYi).toBe(3339.13);
    expect(latest!.sourceUrl).toMatch(/zfcxjst\.gd\.gov\.cn/);
    expect(gdExtractToDepositPct(latest)).toBe(81.7);
    expect(gdLoanToDepositBalancePct(latest)).toBe(71.2);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_provident_annual.py"), "utf8");
    expect(script).toContain("广东省住房公积金");
    expect(script).toContain("zfcxjst.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGdProvidentAnnual");
    expect(dash).toContain("data-gd-provident-annual");
    expect(dash).toContain("data-gd-provident-toggle");
    expect(dash).toContain("gdProvidentExpanded");
  });

  it("CSV 解析", () => {
    const rows = loadGdProvidentAnnualFromCSV(
      [
        "city,year,publish_date,paid_units_wan,paid_persons_wan,deposit_amount_yi,deposit_balance_yi,extract_amount_yi,loan_issued_wan,loan_issued_yi,loan_balance_yi,title,source_org,source_url",
        "广东,2099,2099-01-01,1,2,3,4,5,6,7,8,测试,广东省住房和城乡建设厅,https://zfcxjst.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.loanIssuedWan).toBe(6);
  });
});
