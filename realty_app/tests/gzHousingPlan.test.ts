import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzHousingPlanYoY,
  getLatestGzHousingPlan,
  getGzHousingPlanRows,
  loadGzHousingPlanFromCSV
} from "../src/local/gzHousingPlan";

describe("gz housing development plan", () => {
  it("加载 2026/2025 官方年度计划核心指标", () => {
    const latest = getLatestGzHousingPlan();
    expect(latest).not.toBeNull();
    expect(latest!.year).toBe(2026);
    expect(latest!.approvedPresaleAreaWanSqm).toBe(448.3);
    expect(latest!.residentialLandHa).toBe(216.5);
    expect(latest!.affordableUnitsWan).toBe(3);
    expect(latest!.sourceUrl).toMatch(/zfcj\.gz\.gov\.cn/);
    expect(latest!.publishDate).toBe("2026-06-03");

    const rows = getGzHousingPlanRows();
    expect(rows.map((r) => r.year)).toEqual([2026, 2025]);
    expect(rows[1]!.approvedPresaleAreaWanSqm).toBe(565);
    expect(rows[1]!.residentialLandHa).toBe(515.5);
    expect(rows[1]!.approvedPresaleUnitsWan).toBe(5.4);
  });

  it("同比：预售面积与用地可对上年差分", () => {
    const yoy = getGzHousingPlanYoY();
    expect(yoy).not.toBeNull();
    expect(yoy!.prev.year).toBe(2025);
    expect(yoy!.areaDeltaWan).toBeCloseTo(448.3 - 565, 5);
    expect(yoy!.landDeltaHa).toBeCloseTo(216.5 - 515.5, 5);
  });

  it("爬虫认规划计划栏目与附件解析", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_housing_plan.py"), "utf8");
    expect(script).toContain("zwgk/xxgkml/qt/ghjh");
    expect(script).toContain("住房发展年度计划");
    expect(script).toContain("NamedTemporaryFile");
    expect(script).toContain("docx_text");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-gz-housing-plan");
    expect(dash).toContain("getLatestGzHousingPlan");
  });

  it("CSV 解析", () => {
    const rows = loadGzHousingPlanFromCSV(
      [
        "city,year,publish_date,approved_presale_area_wan_sqm,approved_presale_units_wan,residential_land_ha,affordable_units_wan,source_org,source_url,attachment_url",
        "广州,2099,2099-01-01,100,1,50,2,广州市住房和城乡建设局,https://zfcj.gz.gov.cn/a,https://zfcj.gz.gov.cn/b.doc"
      ].join("\n")
    );
    expect(rows[0]!.approvedPresaleAreaWanSqm).toBe(100);
  });
});
