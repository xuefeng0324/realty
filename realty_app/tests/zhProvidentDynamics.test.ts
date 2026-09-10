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
    // v1.122.29 修：cron 每月自动补最新季报，year/monthEnd 不能硬编码 2026/3
    // 改用 regex 兼容任何 2020+ 年度任意月
    expect(latest!.year).toBeGreaterThanOrEqual(2020);
    expect(latest!.monthEnd).toBeGreaterThanOrEqual(1);
    expect(latest!.monthEnd).toBeLessThanOrEqual(12);
    // 数值改成合理范围（季报量级稳定：月度 10-200 亿，贷款 5-50 亿）
    expect(latest!.depositAmountYi).toBeGreaterThan(10);
    expect(latest!.depositAmountYi).toBeLessThan(200);
    expect(latest!.loanIssuedYi).toBeGreaterThan(1);
    expect(latest!.loanIssuedYi).toBeLessThan(50);
    expect(latest!.loanRatioPct).toBeGreaterThan(50);
    expect(latest!.loanRatioPct).toBeLessThan(80);
    expect(latest!.loanIssuedYoyPct).toBeGreaterThan(-50);
    expect(latest!.loanIssuedYoyPct).toBeLessThan(500);
    expect(latest!.sourceUrl).toMatch(/gjj\.zhuhai\.gov\.cn/);
    // formatZhProvidentPeriod 验证格式（不验证具体值）
    expect(formatZhProvidentPeriod(latest)).toMatch(/^20\d{2} 年 \d+—\d+ 月$/);

    const full = getLatestZhProvidentFullYear();
    expect(full).not.toBeNull();
    expect(full!.year).toBeGreaterThanOrEqual(2020);
    expect(full!.depositAmountYi).toBeGreaterThan(50);
    expect(full!.depositAmountYi).toBeLessThan(300);
    expect(full!.paidPersons).toBeGreaterThan(500000);
    expect(full!.paidPersons).toBeLessThan(1500000);
    expect(formatZhProvidentPeriod(full)).toMatch(/^20\d{2} 全年$/);

    const prior = getZhProvidentSamePeriodPriorYear(latest);
    expect(prior).not.toBeNull();
    expect(prior!.year).toBeLessThan(latest!.year);
    expect(prior!.monthEnd).toBe(latest!.monthEnd);
    expect(prior!.depositAmountYi).toBeGreaterThan(10);
    expect(prior!.depositAmountYi).toBeLessThan(200);
    const delta = getZhProvidentSamePeriodDelta(latest);
    expect(delta).not.toBeNull();
    // delta = latest - prior（容差 1 亿元应对 cron 补数据微调）
    expect(delta!.depositDeltaYi).toBeCloseTo(
      latest!.depositAmountYi - prior!.depositAmountYi,
      1
    );
    expect(delta!.loanDeltaYi).toBeCloseTo(
      latest!.loanIssuedYi - prior!.loanIssuedYi,
      1
    );
    expect(delta!.loanRatioDeltaPct).toBeCloseTo(
      latest!.loanRatioPct - prior!.loanRatioPct,
      1
    );
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
