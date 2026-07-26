import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestNbsPmi,
  getNbsPmiRows,
  loadNbsPmiFromCSV,
  pmiVsThreshold
} from "../src/local/nbsPmi";

describe("nbs purchasing managers index", () => {
  it("加载 PMI 样本", () => {
    const rows = getNbsPmiRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const latest = getLatestNbsPmi();
    expect(latest).not.toBeNull();
    expect(latest!.mfgPmi).toBeGreaterThan(40);
    expect(latest!.mfgPmi).toBeLessThan(60);
    expect(latest!.sourceUrl).toMatch(/stats\.gov\.cn/);
  });

  it("2026-06 对齐官网", () => {
    const jun = getNbsPmiRows().find((r) => r.month === "2026-06");
    expect(jun).toBeTruthy();
    expect(jun!.mfgPmi).toBe(50.3);
    expect(jun!.production).toBe(51.4);
    expect(jun!.newOrders).toBe(51.2);
    expect(jun!.nonMfgBusiness).toBe(50.2);
    expect(jun!.constructionBusiness).toBe(49);
    expect(jun!.compositePmi).toBe(50.6);
  });

  it("临界点偏离", () => {
    expect(pmiVsThreshold(50.3)).toBe(0.3);
    expect(pmiVsThreshold(49)).toBe(-1);
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_nbs_pmi.py"), "utf8");
    expect(script).toContain("采购经理指数");
    expect(script).toContain("construction_business");
    expect(script).toContain("≠");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-nbs-pmi");
    expect(dash).toContain("getLatestNbsPmi");
  });

  it("CSV 解析拒绝非 stats.gov.cn", () => {
    const rows = loadNbsPmiFromCSV(
      [
        "month,publish_date,mfg_pmi,production,new_orders,non_mfg_business,construction_business,services_business,composite_pmi,source_url",
        "2099-01,2099-02-01,50,51,50,50,49,50,50,https://evil.example/x",
        "2099-02,2099-03-01,50.5,51,50.2,50.1,49.5,50.3,50.4,https://www.stats.gov.cn/a"
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.month).toBe("2099-02");
    expect(rows[0]!.mfgPmi).toBe(50.5);
  });
});
