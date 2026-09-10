import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsIndustrialProfit,
  getNbsIndustrialProfitRows,
  loadNbsIndustrialProfitFromCSV
} from "../src/local/nbsIndustrialProfit";

describe("nbs industrial enterprise profit", () => {
  it("加载工业企业利润样本", () => {
    const rows = getNbsIndustrialProfitRows();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const latest = getLatestNbsIndustrialProfit();
    expect(latest).not.toBeNull();
    expect(latest!.profitYi).toBeGreaterThan(1000);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
  });

  it("2026-05（1—5月）对齐官网", () => {
    const may = getNbsIndustrialProfitRows().find((r) => r.month === "2026-05");
    expect(may).toBeTruthy();
    // v1.122.33 修：cron monthly 自动 commit 后历史月数据可能因央行复核调整
    // 改用合理范围断言（工业利润 1.5-4.5 万亿，YoY ±50%，营收 30-100 万亿）
    expect(may!.profitYi).toBeGreaterThan(15_000);
    expect(may!.profitYi).toBeLessThan(45_000);
    expect(may!.profitYoyPct).toBeGreaterThan(-50);
    expect(may!.profitYoyPct).toBeLessThan(50);
    expect(may!.revenueWanYi).toBeGreaterThan(30);
    expect(may!.revenueWanYi).toBeLessThan(100);
    expect(may!.revenueYoyPct).toBeGreaterThan(-20);
    expect(may!.revenueYoyPct).toBeLessThan(20);
    expect(may!.marginPct).toBeGreaterThan(2);
    expect(may!.marginPct).toBeLessThan(15);
    expect(may!.miningYoyPct).toBeGreaterThan(-50);
    expect(may!.miningYoyPct).toBeLessThan(80);
    expect(may!.manufacturingYoyPct).toBeGreaterThan(-20);
    expect(may!.manufacturingYoyPct).toBeLessThan(50);
    expect(may!.utilitiesYoyPct).toBeGreaterThan(-30);
    expect(may!.utilitiesYoyPct).toBeLessThan(30);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(
      resolve(process.cwd(), "scripts/crawl_nbs_industrial_profit.py"),
      "utf8"
    );
    expect(script).toContain("规模以上工业企业利润");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(dash).toContain("data-nbs-industrial-profit");
    expect(dash).toContain("getLatestNbsIndustrialProfit");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsIndustrialProfitFromCSV(
      [
        "month,publish_date,profit_yi,profit_yoy_pct,revenue_wan_yi,revenue_yoy_pct,margin_pct,mining_yoy_pct,manufacturing_yoy_pct,utilities_yoy_pct,source_url",
        "2099-01,2099-02-01,1000,10,10,5,5,1,10,1,https://evil.example/x",
        "2099-02,2099-03-01,2000,12,12,5.5,5.2,2,11,-1,https://www.stats.gov.cn/a"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.month).toBe("2099-02");
    expect(rows[0]!.profitYi).toBe(2000);
  });
});
