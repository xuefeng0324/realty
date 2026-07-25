import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatZhProvidentPeriod,
  getLatestZhProvidentDynamics,
  getLatestZhProvidentFullYear,
  getZhProvidentDynamicsRows,
  getZhProvidentSamePeriodDelta,
  getZhProvidentSamePeriodPriorYear,
  loadZhProvidentDynamicsFromCSV
} from "../src/local/zhProvidentDynamics";

describe("zh provident dynamics", () => {
  it("加载珠海公积金动态多期", () => {
    const rows = getZhProvidentDynamicsRows();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const latest = getLatestZhProvidentDynamics();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2026);
    expect(latest!.monthEnd).toBe(3);
    expect(latest!.depositAmountYi).toBe(35.6885);
    expect(latest!.loanIssuedYi).toBe(9.8661);
    expect(latest!.loanRatioPct).toBe(63);
    expect(latest!.loanIssuedYoyPct).toBe(195);
    expect(latest!.sourceUrl).toMatch(/gjj\.zhuhai\.gov\.cn/);
    expect(formatZhProvidentPeriod(latest)).toBe("2026 年 1—3 月");

    const full = getLatestZhProvidentFullYear();
    expect(full).not.toBeNull();
    expect(full!.year).toBe(2025);
    expect(full!.depositAmountYi).toBe(144.742);
    expect(full!.paidPersons).toBe(897248);
    expect(formatZhProvidentPeriod(full)).toBe("2025 全年");

    const prior = getZhProvidentSamePeriodPriorYear(latest);
    expect(prior).not.toBeNull();
    expect(prior!.year).toBe(2025);
    expect(prior!.monthEnd).toBe(3);
    expect(prior!.depositAmountYi).toBe(34.629);
    const delta = getZhProvidentSamePeriodDelta(latest);
    expect(delta).not.toBeNull();
    expect(delta!.depositDeltaYi).toBe(1.0595);
    expect(delta!.loanDeltaYi).toBe(6.5203);
    expect(delta!.loanRatioDeltaPct).toBe(-6);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_zh_provident_dynamics.py"), "utf8");
    expect(script).toContain("住房公积金动态");
    expect(script).toContain("gjj.zhuhai.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestZhProvidentDynamics");
    expect(dash).toContain("data-zh-provident-dynamics");
    expect(dash).toContain("data-zh-provident-same-period");
    expect(dash).toContain("getZhProvidentSamePeriodDelta");
  });

  it("CSV 解析", () => {
    const rows = loadZhProvidentDynamicsFromCSV(
      [
        "city,year,month_end,as_of_date,publish_date,deposit_amount_yi,deposit_yoy_pct,extract_amount_yi,extract_yoy_pct,extract_rate_pct,loan_issued_yi,loan_issued_yoy_pct,loan_balance_yi,loan_ratio_pct,paid_persons,deposit_balance_yi,title,source_org,source_url",
        "珠海,2099,6,2099-06-30,2099-07-01,1,2,3,4,5,6,7,8,9,10,11,测试,珠海市住房公积金管理中心,https://gjj.zhuhai.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.loanIssuedYi).toBe(6);
  });
});
