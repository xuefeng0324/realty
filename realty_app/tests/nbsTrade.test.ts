import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsTrade,
  getNbsTradeRows,
  loadNbsTradeFromCSV
} from "../src/local/nbsTrade";

describe("nbs goods trade (customs via NBS)", () => {
  it("加载货物进出口样本", () => {
    const rows = getNbsTradeRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const latest = getLatestNbsTrade();
    expect(latest).not.toBeNull();
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect((latest!.totalMonthYi ?? latest!.totalCumYi) ?? 0).toBeGreaterThan(10_000);
  });

  it("2026-06 对齐官网国民经济通稿", () => {
    const jun = getNbsTradeRows().find((r) => r.month === "2026-06");
    expect(jun).toBeTruthy();
    expect(jun!.totalMonthYi).toBe(47823);
    expect(jun!.totalMonthYoyPct).toBe(24.2);
    expect(jun!.exportMonthYi).toBe(28207);
    expect(jun!.importMonthYi).toBe(19616);
    expect(jun!.surplusMonthYi).toBe(8591);
  });

  it("2026-02 仅累计无当月误填", () => {
    const feb = getNbsTradeRows().find((r) => r.month === "2026-02");
    expect(feb).toBeTruthy();
    expect(feb!.totalMonthYi).toBeNull();
    expect(feb!.totalCumYi).toBe(77321);
    expect(feb!.exportCumYi).toBe(46178);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_trade.py"), "utf8");
    expect(script).toContain("进出口总额");
    expect(script).toContain("海关总署");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-nbs-trade");
    expect(dash).toContain("getLatestNbsTrade");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsTradeFromCSV(
      [
        "month,publish_date,total_month_yi,total_month_yoy_pct,export_month_yi,export_month_yoy_pct,import_month_yi,import_month_yoy_pct,surplus_month_yi,total_cum_yi,total_cum_yoy_pct,export_cum_yi,export_cum_yoy_pct,import_cum_yi,import_cum_yoy_pct,surplus_cum_yi,source_url",
        "2099-01,2099-02-01,100,1,60,1,40,1,20,100,1,60,1,40,1,20,https://evil.example/x",
        "2099-02,2099-03-01,200,2,120,2,80,2,40,300,1.5,180,1.5,120,1.5,60,https://www.stats.gov.cn/a"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.month).toBe("2099-02");
    expect(rows[0]!.surplusMonthYi).toBe(40);
  });
});
