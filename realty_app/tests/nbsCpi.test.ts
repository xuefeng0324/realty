import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsCpi,
  getNbsCpiTrend,
  loadNbsCpiFromCSV,
  shortNbsCpiMonthLabel
} from "../src/local/nbsCpi";
import { getLatestNbsIncome, getNbsIncomeTrend } from "../src/local/nbsIncome";

describe("nbs cpi", () => {
  it("加载月度 CPI 与居住/房租", () => {
    const latest = getLatestNbsCpi();
    expect(latest).not.toBeNull();
    // v1.122.12：cron 每月自动补最新月，断言改为「最近 4 个月内」即可，
    // 不再硬编码 month / 数值（数值随月变化）。
    expect(latest!.month).toMatch(/^2026-(0[5-9]|10)$/);
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
  it("含 2025 多期与最新 2026 上半年", () => {
    const latest = getLatestNbsIncome();
    expect(latest!.period).toBe("2026_H1");
    const trend = getNbsIncomeTrend(8);
    expect(trend.length).toBeGreaterThanOrEqual(6);
    expect(trend.some((r) => r.period === "2025")).toBe(true);
    expect(trend.some((r) => r.period === "2025_Q3")).toBe(true);
  });
});
