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
    // v1.122.29 修：年度报告 year 不能硬编码 2024（每年补一年）
    // 改用 regex 兼容任何 2020+ 年度
    expect(latest!.year).toBeGreaterThanOrEqual(2020);
    // 数值改成合理范围（每年绝对值变化，但量级稳定）
    expect(latest!.depositAmountYi).toBeGreaterThan(1000);
    expect(latest!.depositAmountYi).toBeLessThan(8000);
    expect(latest!.depositBalanceYi).toBeGreaterThan(5000);
    expect(latest!.depositBalanceYi).toBeLessThan(20000);
    expect(latest!.loanIssuedWan).toBeGreaterThan(5);
    expect(latest!.loanIssuedWan).toBeLessThan(40);
    expect(latest!.loanIssuedYi).toBeGreaterThan(300);
    expect(latest!.loanIssuedYi).toBeLessThan(3000);
    expect(latest!.extractAmountYi).toBeGreaterThan(1500);
    expect(latest!.extractAmountYi).toBeLessThan(6000);
    expect(latest!.sourceUrl).toMatch(/zfcxjst\.gd\.gov\.cn/);
    // gdExtractToDepositPct / gdLoanToDepositBalancePct 是派生比例（不依赖 year）
    expect(gdExtractToDepositPct(latest)).toBeGreaterThan(60);
    expect(gdExtractToDepositPct(latest)).toBeLessThan(100);
    expect(gdLoanToDepositBalancePct(latest)).toBeGreaterThan(50);
    expect(gdLoanToDepositBalancePct(latest)).toBeLessThan(90);
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
