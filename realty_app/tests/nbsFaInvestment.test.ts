import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsFaInvestment,
  getNbsFaInvestmentTrend,
  loadNbsFaInvestmentFromCSV,
  shortNbsFaPeriodLabel
} from "../src/local/nbsFaInvestment";

describe("nbs fa investment", () => {
  it("加载全国固定资产投资基本情况", () => {
    const latest = getLatestNbsFaInvestment();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026-01_to_2026-06");
    expect(latest!.faCny100m).toBe(226370);
    expect(latest!.faYoyPct).toBe(-5.7);
    expect(latest!.privateYoyPct).toBe(-8.5);
    expect(latest!.manufacturingYoyPct).toBe(-1.2);
    expect(latest!.equipmentYoyPct).toBe(8.1);
    expect(latest!.ipYoyPct).toBe(9.4);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
    expect(getNbsFaInvestmentTrend(3).length).toBe(3);
    expect(shortNbsFaPeriodLabel(latest!.period)).toBe("1—6");
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_fa_investment.py"), "utf8");
    expect(script).toContain("全国固定资产投资基本情况");
    expect(script).toContain("stats.gov.cn");
    expect(script).toContain("--backfill");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestNbsFaInvestment");
    expect(dash).toContain("data-nbs-fa-investment");
    expect(dash).not.toMatch(/全国固投[\s\S]{0,40}成交均价/);
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsFaInvestmentFromCSV(
      [
        "period,publish_date,fa_cny_100m,fa_yoy_pct,private_yoy_pct,state_yoy_pct,primary_yoy_pct,secondary_yoy_pct,tertiary_yoy_pct,manufacturing_yoy_pct,equipment_yoy_pct,ip_yoy_pct,source_url",
        "2099-01_to_2099-06,2099-07-01,1,-1,-2,-3,-4,-5,-6,-7,-8,9,https://example.com/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});
