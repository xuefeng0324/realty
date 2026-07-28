import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsIndustrial,
  getNbsIndustrialRows,
  loadNbsIndustrialFromCSV
} from "../src/local/nbsIndustrial";

describe("nbs industrial value added", () => {
  it("加载工业增加值样本", () => {
    const rows = getNbsIndustrialRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const latest = getLatestNbsIndustrial();
    expect(latest).not.toBeNull();
    expect(latest!.yoyPct).toBeGreaterThan(-20);
    expect(latest!.yoyPct).toBeLessThan(30);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
  });

  it("2026-06 对齐官网", () => {
    const jun = getNbsIndustrialRows().find((r) => r.month === "2026-06");
    expect(jun).toBeTruthy();
    expect(jun!.yoyPct).toBe(5.3);
    expect(jun!.momPct).toBe(0.76);
    expect(jun!.ytdYoyPct).toBe(5.4);
    expect(jun!.miningYoyPct).toBe(-2.2);
    expect(jun!.manufacturingYoyPct).toBe(6);
    expect(jun!.utilitiesYoyPct).toBe(7.4);
    expect(jun!.cementWanT).toBe(14423);
    expect(jun!.cementYoyPct).toBe(-5.6);
    expect(jun!.cementYtdYoyPct).toBe(-8);
    expect(jun!.steelYoyPct).toBe(0);
    expect(jun!.flatGlassYoyPct).toBe(-5.3);
    expect(jun!.crudeSteelYoyPct).toBe(0.4);
  });

  it("2026-04 取当月同比而非累计标题", () => {
    const apr = getNbsIndustrialRows().find((r) => r.month === "2026-04");
    expect(apr).toBeTruthy();
    expect(apr!.yoyPct).toBe(4.1);
    expect(apr!.ytdYoyPct).toBe(5.6);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_industrial.py"), "utf8");
    expect(script).toContain("规模以上工业增加值");
    expect(script).toContain("product_table");
    expect(script).toContain("cement_yoy_pct");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(dash).toContain("data-nbs-industrial");
    expect(dash).toContain("data-nbs-industrial-materials");
    expect(dash).toContain("getLatestNbsIndustrial");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsIndustrialFromCSV(
      [
        "month,publish_date,yoy_pct,mom_pct,ytd_yoy_pct,mining_yoy_pct,manufacturing_yoy_pct,utilities_yoy_pct,cement_wan_t,cement_yoy_pct,cement_ytd_yoy_pct,flat_glass_wan_weight_box,flat_glass_yoy_pct,steel_wan_t,steel_yoy_pct,crude_steel_wan_t,crude_steel_yoy_pct,source_url",
        "2099-01,2099-02-01,5,0.1,5,1,5,5,,,,,,,,,,https://evil.example/x",
        "2099-02,2099-03-01,5.5,0.2,5.2,1.1,5.1,5.3,100,-1,-2,200,-3,300,0,400,0.5,https://www.stats.gov.cn/a"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.month).toBe("2099-02");
    expect(rows[0]!.yoyPct).toBe(5.5);
    expect(rows[0]!.cementYoyPct).toBe(-1);
    expect(rows[0]!.steelYoyPct).toBe(0);
  });
});
