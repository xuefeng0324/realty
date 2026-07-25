/**
 * Adversarial probes: China A-share color semantics + cityName sync fallback.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatSzSupplyPeriod,
  getLatestSzPlannedSupply,
  getSzPlannedSupplyRows,
  getSzSupplyQoQDelta,
  loadSzPlannedSupplyFromCSV,
  residentialSharePct
} from "../src/local/szPlannedSupply";

describe("adversarial color + cityName + sz supply", () => {
  it("P1: stats70-up / wangqian-up / wq-trend-up 须涨红（与 trend-up 同向），不能涨绿", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    // extract last definition wins in cascade within file — assert China reds present for *-up
    expect(css).toMatch(/\.stats70-up\s*\{[^}]*color:\s*#ef4444/);
    expect(css).toMatch(/\.wangqian-up\s*\{[^}]*color:\s*#ef4444/);
    expect(css).toMatch(/\.wq-trend-up\s*\{[^}]*color:\s*#ef4444/);
    expect(css).not.toMatch(/\.stats70-up\s*\{\s*color:\s*#4ade80/);
    expect(css).not.toMatch(/\.wangqian-up\s*\{\s*color:\s*#4ade80/);
    const wq = readFileSync(resolve(process.cwd(), "src/pages/wangqian/wangqian.vue"), "utf8");
    expect(wq).toMatch(/\.trend-up\s*\{[^}]*#ef4444/);
    expect(wq).not.toMatch(/\.trend-up\s*\{[^}]*#4ade80/);
  });

  it("P1: LPR 利率升用 rateDeltaClass（涨红），禁止 delta>0 → trend-down 反色", () => {
    const src = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(src).toContain("function rateDeltaClass");
    expect(src).toContain("rateDeltaClass(lprDelta12m.lpr5yDeltaBp)");
    expect(src).not.toMatch(/lprDelta12m\.lpr1yDeltaBp\s*>\s*0\s*\?\s*['\"]trend-down['\"]/);
    expect(src).not.toMatch(/lprYoY\.lpr5yDeltaBp\s*<=\s*0\s*\?\s*['\"]trend-up['\"]/);
  });

  it("P1: cityNameForId 须回退 store.getCityById", () => {
    const src = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(src).toMatch(/function cityNameForId[\s\S]*?store\.getCityById\(cityId\)/);
  });

  it("深圳计划入市：最新季为 2026Q3，环比可算", () => {
    const latest = getLatestSzPlannedSupply();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2026);
    expect(latest!.quarter).toBe(3);
    expect(latest!.totalUnits).toBe(7212);
    expect(latest!.residentialUnits).toBe(6929);
    expect(latest!.sourceUrl).toMatch(/^https:\/\/zjj\.sz\.gov\.cn\//);
    expect(formatSzSupplyPeriod(latest!)).toBe("2026 年 Q3");
    expect(getSzPlannedSupplyRows().length).toBeGreaterThanOrEqual(4);
    const qoq = getSzSupplyQoQDelta();
    expect(qoq).not.toBeNull();
    expect(qoq!.prev.year).toBe(2026);
    expect(qoq!.prev.quarter).toBe(2);
    expect(qoq!.unitsDelta).toBe(7212 - 10909);
    expect(residentialSharePct(latest)).toBe(Math.round((6929 / 7212) * 1000) / 10);
  });

  it("CSV 解析支持 RFC4180；爬虫脚本认住建局域名", () => {
    const rows = loadSzPlannedSupplyFromCSV(
      [
        "city,year,quarter,as_of_date,publish_date,project_count,total_units,total_area_sqm,residential_units,residential_area_sqm,apartment_units,apartment_area_sqm,commercial_units,commercial_area_sqm,office_units,office_area_sqm,source_org,source_url",
        '深圳,2099,1,2099-01-01,2099-01-02,1,10,100,8,80,0,0,0,0,0,0,"深圳市住房和建设局",https://zjj.sz.gov.cn/a'
      ].join("\n")
    );
    expect(rows[0]!.sourceOrg).toBe("深圳市住房和建设局");
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_sz_planned_supply.py"), "utf8");
    expect(script).toContain("zjj.sz.gov.cn");
    expect(script).toContain("计划入市");
    expect(script).toContain("NamedTemporaryFile");
  });
});
