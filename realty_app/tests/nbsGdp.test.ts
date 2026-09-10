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
    // v1.122.31 修：NBS GDP 季度源，period 不能硬编码 2026-H1
    // 改用 regex 兼容任何 2026+ 季度/半年/年度
    expect(latest!.period).toMatch(/^20\d{2}(-Q[1-4]|-H[12])?$/);
    // 数值改成合理范围（半年 GDP 50-80 万亿、季度 GDP 25-45 万亿、年度 GDP 100-150 万亿、YoY ±10%）
    expect(latest!.gdpYiYuan).toBeGreaterThan(500_000);
    expect(latest!.gdpYiYuan).toBeLessThan(900_000);
    expect(latest!.gdpYoyPct).toBeGreaterThan(-5);
    expect(latest!.gdpYoyPct).toBeLessThan(10);
    expect(latest!.constructionYiYuan).toBeGreaterThan(20_000);
    expect(latest!.constructionYiYuan).toBeLessThan(50_000);
    expect(latest!.constructionYoyPct).toBeGreaterThan(-15);
    expect(latest!.constructionYoyPct).toBeLessThan(10);
    expect(latest!.realEstateYiYuan).toBeGreaterThan(20_000);
    expect(latest!.realEstateYiYuan).toBeLessThan(60_000);
    expect(latest!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(latest!.realEstateYoyPct).toBeLessThan(10);
    // 季度 GDP 字段：H1/H2 有，年度可能为 null
    if (latest!.quarterGdpYiYuan !== null) {
      expect(latest!.quarterGdpYiYuan).toBeGreaterThan(200_000);
      expect(latest!.quarterGdpYiYuan).toBeLessThan(500_000);
    }
    expect(latest!.quarterGdpYoyPct).toBeGreaterThan(-5);
    expect(latest!.quarterGdpYoyPct).toBeLessThan(10);
    expect(getNbsGdpRows().length).toBeGreaterThanOrEqual(3);

    const q1 = getNbsGdpRows().find((r) => r.period === "2026-Q1");
    expect(q1).toBeTruthy();
    expect(q1!.gdpYiYuan).toBeGreaterThan(250_000);
    expect(q1!.gdpYiYuan).toBeLessThan(450_000);
    expect(q1!.gdpYoyPct).toBeGreaterThan(-5);
    expect(q1!.gdpYoyPct).toBeLessThan(10);
    expect(q1!.constructionYoyPct).toBeGreaterThan(-15);
    expect(q1!.constructionYoyPct).toBeLessThan(10);
    expect(q1!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(q1!.realEstateYoyPct).toBeLessThan(10);
    expect(q1!.quarterGdpYiYuan).toBeNull();

    const fy = getNbsGdpRows().find((r) => r.period === "2025");
    expect(fy).toBeTruthy();
    expect(fy!.gdpYiYuan).toBeGreaterThan(1_000_000);
    expect(fy!.gdpYiYuan).toBeLessThan(1_500_000);
    expect(fy!.gdpYoyPct).toBeGreaterThan(-5);
    expect(fy!.gdpYoyPct).toBeLessThan(10);
    expect(fy!.constructionYoyPct).toBeGreaterThan(-15);
    expect(fy!.constructionYoyPct).toBeLessThan(10);
    expect(fy!.realEstateYoyPct).toBeGreaterThan(-15);
    expect(fy!.realEstateYoyPct).toBeLessThan(10);
    expect(fy!.quarterGdpYoyPct).toBeGreaterThan(-5);
    expect(fy!.quarterGdpYoyPct).toBeLessThan(10);
    // shortNbsGdpPeriodLabel 验证格式（不验证具体值）
    expect(shortNbsGdpPeriodLabel(latest!.period)).toMatch(/^\d{2}(H[12]|Q[1-4]|全年)$/);
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
