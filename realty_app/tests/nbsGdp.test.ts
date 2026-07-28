import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsGdp,
  getNbsGdpRows,
  loadNbsGdpFromCSV,
  shortNbsGdpPeriodLabel
} from "../src/local/nbsGdp";

describe("nbs gdp", () => {
  it("加载季度 GDP 与建筑业/房地产业增加值", () => {
    const latest = getLatestNbsGdp();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026-H1");
    expect(latest!.gdpYiYuan).toBe(695704);
    expect(latest!.gdpYoyPct).toBe(4.7);
    expect(latest!.constructionYiYuan).toBe(36043);
    expect(latest!.constructionYoyPct).toBe(-4);
    expect(latest!.realEstateYiYuan).toBe(41365);
    expect(latest!.realEstateYoyPct).toBe(-0.2);
    expect(latest!.quarterGdpYiYuan).toBe(361511);
    expect(latest!.quarterGdpYoyPct).toBe(4.3);
    expect(getNbsGdpRows().length).toBeGreaterThanOrEqual(3);

    const q1 = getNbsGdpRows().find((r) => r.period === "2026-Q1");
    expect(q1).toBeTruthy();
    expect(q1!.gdpYiYuan).toBe(334193);
    expect(q1!.gdpYoyPct).toBe(5);
    expect(q1!.constructionYoyPct).toBe(-3.8);
    expect(q1!.realEstateYoyPct).toBe(-0.1);
    expect(q1!.quarterGdpYiYuan).toBeNull();

    const fy = getNbsGdpRows().find((r) => r.period === "2025");
    expect(fy).toBeTruthy();
    expect(fy!.gdpYiYuan).toBe(1401879);
    expect(fy!.gdpYoyPct).toBe(5);
    expect(fy!.constructionYoyPct).toBe(-1.1);
    expect(fy!.realEstateYoyPct).toBe(0.2);
    expect(fy!.quarterGdpYoyPct).toBe(4.5);
    expect(shortNbsGdpPeriodLabel("2026-H1")).toBe("26H1");
    expect(shortNbsGdpPeriodLabel("2025")).toBe("25全年");
  });

  it("爬虫与宏观产业页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_gdp.py"), "utf8");
    expect(script).toContain("国内生产总值初步核算");
    expect(script).toContain("房地产业");
    expect(script).toContain("建筑业");
    expect(script).toContain("≠");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-industry/macro-industry.vue"), "utf8");
    expect(page).toContain("data-nbs-gdp");
    expect(page).toContain("data-nbs-gdp-housing");
    expect(page).toContain("getLatestNbsGdp");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsGdpFromCSV(
      [
        "period,label,publish_date,gdp_yi_yuan,gdp_yoy_pct,primary_yi_yuan,primary_yoy_pct,secondary_yi_yuan,secondary_yoy_pct,tertiary_yi_yuan,tertiary_yoy_pct,industry_yi_yuan,industry_yoy_pct,construction_yi_yuan,construction_yoy_pct,real_estate_yi_yuan,real_estate_yoy_pct,quarter_gdp_yi_yuan,quarter_gdp_yoy_pct,source_url",
        "2099,x,2099-01-01,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,https://evil.example/x"
      ].join("\n")
    );
    expect(rows).toEqual([]);
  });
});
