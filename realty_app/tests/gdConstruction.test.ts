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
    // v1.122.29 修：源站每季度发布（Q1/H1/Q3 或年度），period 不能硬编码 2026_Q1
    // 改用 regex 兼容任何 2026+ 季度/年度
    expect(latest!.period).toMatch(/^20\d{2}(_Q[1-4]|_H[12]|\d{4})?$/);
    // 数值改成合理范围（cron 自动补后 Q2/H1/Q3/年度 数据会变）
    expect(latest!.totalOutputYi).toBeGreaterThan(3000);
    expect(latest!.totalOutputYi).toBeLessThan(30000);
    expect(latest!.housingOutputYi).toBeGreaterThan(1500);
    expect(latest!.housingOutputYi).toBeLessThan(15000);
    expect(latest!.totalOutputYoyPct).toBeGreaterThan(-15);
    expect(latest!.totalOutputYoyPct).toBeLessThan(15);
    expect(latest!.sourceUrl).toMatch(/zfcxjst\.gd\.gov\.cn/);
    // gdHousingSharePct 计算 = housing/total，不依赖具体 period
    expect(gdHousingSharePct(latest)).toBeGreaterThan(40);
    expect(gdHousingSharePct(latest)).toBeLessThan(60);
    expect(getGdConstructionTrend(3).length).toBeGreaterThanOrEqual(3);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gd_construction.py"), "utf8");
    expect(script).toContain("建筑业生产运行简况");
    expect(script).toContain("zfcxjst.gd.gov.cn");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/macro-region/macro-region.vue"), "utf8");
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
