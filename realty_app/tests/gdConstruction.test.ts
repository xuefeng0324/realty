import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gdHousingSharePct,
  getGdConstructionTrend,
  getLatestGdConstruction,
  loadGdConstructionFromCSV
} from "../src/local/gdConstruction";

describe("gd construction", () => {
  it("加载广东建筑业生产运行简况", () => {
    const latest = getLatestGdConstruction();
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe("2026_Q1");
    expect(latest!.totalOutputYi).toBe(4745.22);
    expect(latest!.housingOutputYi).toBe(2446.76);
    expect(latest!.totalOutputYoyPct).toBe(-5.9);
    expect(latest!.sourceUrl).toMatch(/zfcxjst\.gd\.gov\.cn/);
    expect(gdHousingSharePct(latest)).toBe(51.6);
    expect(getGdConstructionTrend(3).length).toBeGreaterThanOrEqual(3);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_construction.py"), "utf8");
    expect(script).toContain("建筑业生产运行简况");
    expect(script).toContain("zfcxjst.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGdConstruction");
    expect(dash).toContain("data-gd-construction");
  });

  it("CSV 解析", () => {
    const rows = loadGdConstructionFromCSV(
      [
        "region,period,period_label,publish_date,sort_key,total_output_yi,total_output_yoy_pct,housing_output_yi,housing_output_yoy_pct,civil_output_yi,civil_output_yoy_pct,pr_output_yi,pr_output_yoy_pct,title,source_org,source_url",
        "广东,2099_Q1,2099年一季度,2099-01-01,2099-03,100,-1,40,-2,30,-3,80,-4,测试,广东省住房和城乡建设厅,https://zfcxjst.gd.gov.cn/a"
      ].join("\n")
    );
    expect(rows[0]!.totalOutputYi).toBe(100);
  });
});
