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
    // v1.122.29 修：年度报告 year 不能硬编码 2025（明年补 2026 后会变）
    // 改用 regex 兼容任何 2015+ 年度
    expect(latest!.year).toBeGreaterThanOrEqual(2015);
    // 数值改成合理范围（每年绝对值变化，但量级稳定）
    expect(latest!.loanIssuedWan).toBeGreaterThan(1);
    expect(latest!.loanIssuedWan).toBeLessThan(15);
    expect(latest!.loanIssuedYi).toBeGreaterThan(100);
    expect(latest!.loanIssuedYi).toBeLessThan(1500);
    expect(latest!.loanBalanceYi).toBeGreaterThan(1000);
    expect(latest!.loanBalanceYi).toBeLessThan(5000);
    expect(latest!.depositBalanceYi).toBeGreaterThan(1000);
    expect(latest!.depositBalanceYi).toBeLessThan(6000);
    expect(latest!.supportPurchaseWanSqm).toBeGreaterThan(100);
    expect(latest!.supportPurchaseWanSqm).toBeLessThan(800);
    expect(latest!.sourceUrl).toMatch(/zjj\.sz\.gov\.cn/);
    // 派生比例（不依赖 year）
    expect(extractToDepositPct(latest)).toBeGreaterThan(60);
    expect(extractToDepositPct(latest)).toBeLessThan(100);
    expect(loanToDepositBalancePct(latest)).toBeGreaterThan(50);
    expect(loanToDepositBalancePct(latest)).toBeLessThan(90);
    // 上年行：rows 按 year desc 排，第 1 行就是 prior
    const prior = rows[1]!;
    expect(prior.year).toBeLessThan(latest!.year);
    expect(prior.depositAmountYi).toBeGreaterThan(500);
    expect(prior.depositAmountYi).toBeLessThan(3000);
    expect(prior.loanIssuedYi).toBeGreaterThan(100);
    expect(prior.loanIssuedYi).toBeLessThan(1000);
    const delta = getSzProvidentYearDelta(latest);
    expect(delta).not.toBeNull();
    // delta.prior = rows[1]（按 year desc 排）
    expect(delta!.prior.year).toBeLessThan(latest!.year);
    // depositDeltaYi = latest.deposit - prior.deposit（容差 1 亿元应对 cron 补数据微调）
    expect(delta!.depositDeltaYi).toBeCloseTo(
      latest!.depositAmountYi - prior.depositAmountYi,
      1
    );
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
