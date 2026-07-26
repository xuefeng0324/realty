import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsPpi,
  getNbsPpiTrend,
  loadNbsPpiFromCSV,
  shortNbsPpiMonthLabel
} from "../src/local/nbsPpi";

describe("nbs ppi", () => {
  it("加载月度 PPI 与购进/建材分项", () => {
    const latest = getLatestNbsPpi();
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe("2026-06");
    expect(latest!.ppiYoyPct).toBe(4.1);
    expect(latest!.ppiMomPct).toBe(-0.3);
    expect(latest!.purchaseYoyPct).toBe(6.4);
    expect(latest!.nonMetalYoyPct).toBe(-4.4);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsPpiTrend(6).length).toBeGreaterThanOrEqual(6);
    expect(shortNbsPpiMonthLabel("2026-06")).toBe("6月");
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_ppi.py"), "utf8");
    expect(script).toContain("工业生产者出厂价格");
    expect(script).toContain("非金属矿物制品业");
    expect(script).toContain("二、工业生产者购进价格");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestNbsPpi");
    expect(dash).toContain("data-nbs-ppi");
    expect(dash).toContain("建材相关 · ≠房价");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsPpiFromCSV(
      [
        "month,publish_date,ppi_yoy_pct,ppi_mom_pct,purchase_yoy_pct,non_metal_yoy_pct,source_url",
        "2099-01,2099-01-01,1,1,1,1,https://example.com/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});
