import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGdFaInvestmentTrend,
  getLatestGdFaInvestment,
  loadGdFaInvestmentFromCSV
} from "../src/local/gdFaInvestment";

describe("gd fa investment", () => {
  it("加载广东固定资产投资简况", () => {
    const latest = getLatestGdFaInvestment();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_H1");
    expect(latest!.faYoyPct).toBe(-11.4);
    expect(latest!.industryYoyPct).toBe(-13.9);
    expect(latest!.manufacturingYoyPct).toBe(-14.4);
    expect(latest!.prYoyPct).toBe(-10.9);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdFaInvestmentTrend(2).length).toBeGreaterThanOrEqual(2);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_fa_investment.py"), "utf8");
    expect(script).toContain("固定资产投资运行简况");
    expect(script).toContain("stats.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(dash).toContain("getLatestGdFaInvestment");
    expect(dash).toContain("data-gd-fa-investment");
  });

  it("CSV 解析", () => {
    const rows = loadGdFaInvestmentFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,fa_yoy_pct,primary_yoy_pct,secondary_yoy_pct,tertiary_yoy_pct,industry_yoy_pct,manufacturing_yoy_pct,pr_yoy_pct,east_yoy_pct,west_yoy_pct,north_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-01-01,2099-06,-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,测试,广东省统计局,http://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.faYoyPct).toBe(-1);
  });
});
