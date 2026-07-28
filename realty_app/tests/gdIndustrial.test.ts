import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGdIndustrialTrend,
  getLatestGdIndustrial,
  loadGdIndustrialFromCSV
} from "../src/local/gdIndustrial";

describe("gd industrial", () => {
  it("加载广东规上工业简况（增加值同比与门类）", () => {
    const latest = getLatestGdIndustrial();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_H1");
    expect(latest!.industryYoyPct).toBe(5.8);
    expect(latest!.manufacturingYoyPct).toBe(5.4);
    expect(latest!.electronicsYoyPct).toBe(11.6);
    expect(latest!.sourceUrl).toMatch(/stats\.gd\.gov\.cn/);
    expect(getGdIndustrialTrend(3).length).toBeGreaterThanOrEqual(3);
  });

  it("爬虫与宏观区域页门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_industrial.py"), "utf8");
    expect(script).toContain("规模以上工业生产运行简况");
    expect(script).toContain("stats.gd.gov.cn");
    const page = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
    expect(page).toContain("data-gd-industrial");
    expect(page).toContain("getLatestGdIndustrial");
  });

  it("CSV 解析", () => {
    const rows = loadGdIndustrialFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,industry_yoy_pct,mining_yoy_pct,manufacturing_yoy_pct,utilities_yoy_pct,electronics_yoy_pct,electrical_yoy_pct,auto_yoy_pct,robot_yoy_pct,ic_yoy_pct,title,source_org,source_url",
        "广东,2099_H1,2099年上半年,2099-07-01,2099-06,1.5,2,1,3,4,5,6,7,8,测试,广东省统计局,https://stats.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.industryYoyPct).toBe(1.5);
    expect(rows[0]!.autoYoyPct).toBe(6);
  });
});
