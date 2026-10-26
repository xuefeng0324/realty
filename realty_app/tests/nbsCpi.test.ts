import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsCpi,
  getNbsCpiRows,
  getNbsCpiTrend,
  loadNbsCpiFromCSV,
  shortNbsCpiMonthLabel
} from "../src/local/nbsCpi";
import { getLatestNbsIncome, getNbsIncomeTrend } from "../src/local/nbsIncome";

describe("nbs cpi", () => {
  it("加载月度 CPI 与居住/房租", () => {
    const latest = getLatestNbsCpi();
    expect(latest).not.toBeNull();
    // v1.122.12：cron 每月自动补最新月，数值随月变化，只断言量级。
    // v1.122.54 修：旧断言把月份写死在 2026-05..2026-10，12 月 cron 抓到
    // 2026-11 CPI 就会红。改成「格式合法 + 是全表最大月 + 月份不重复」。
    expect(latest!.month).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
    const allMonths = getNbsCpiRows().map((r) => r.month);
    expect(latest!.month).toBe(allMonths[0]);
    expect(new Set(allMonths).size).toBe(allMonths.length);
    expect(latest!.cpiYoyPct).toBeGreaterThan(-3);
    expect(latest!.cpiYoyPct).toBeLessThan(8);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsCpiTrend(6).length).toBe(6);
    expect(shortNbsCpiMonthLabel("2026-06")).toBe("6月");
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_cpi.py"), "utf8");
    expect(script).toContain("居民消费价格");
    expect(script).toContain("租赁房房租");
    expect(script).toContain("三、居住");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(dash).toContain("getLatestNbsCpi");
    expect(dash).toContain("data-nbs-cpi");
    expect(dash).toContain("房租 ≠ 房价");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsCpiFromCSV(
      [
        "month,publish_date,cpi_yoy_pct,cpi_mom_pct,residence_yoy_pct,rent_yoy_pct,source_url",
        "2099-01,2099-01-01,1,1,1,1,https://example.com/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});

describe("nbs income backfill", () => {
  it("含 2025 多期与最新一期（期次由 CSV 决定）", () => {
    const latest = getLatestNbsIncome();
    // v1.122.54 修：同 nbsIncome.test —— 累计口径期次有 Q1/H1/Q3/年度 4 种，
    // 不能把「最新一期」写死成半年报。
    expect(latest!.period).toMatch(/^20\d{2}(_[HQ][1-4])?$/);
    const trend = getNbsIncomeTrend(8);
    expect(trend.length).toBeGreaterThanOrEqual(6);
    // 趋势中应含年度 + Q3 行（具体 period 值由 CSV 决定，不能硬编码）
    expect(trend.some((r) => r.period === "2025")).toBe(true);
    expect(trend.some((r) => r.period === "2025_Q3")).toBe(true);
  });
});
