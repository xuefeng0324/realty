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
    // v1.122.29 修：年度计划 year 不能硬编码 2026（明年补 2027 后会变）
    // 改用 regex 兼容任何 2020+ 年度；publishDate 同理
    expect(latest!.year).toBeGreaterThanOrEqual(2020);
    expect(latest!.publishDate).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
    // 数值改成合理范围（每年绝对值变化，但量级稳定）
    expect(latest!.approvedPresaleAreaWanSqm).toBeGreaterThan(300);
    expect(latest!.approvedPresaleAreaWanSqm).toBeLessThan(800);
    expect(latest!.residentialLandHa).toBeGreaterThan(100);
    expect(latest!.residentialLandHa).toBeLessThan(600);
    expect(latest!.affordableUnitsWan).toBeGreaterThanOrEqual(0);
    expect(latest!.affordableUnitsWan).toBeLessThan(10);
    expect(latest!.sourceUrl).toMatch(/zfcj\.gz\.gov\.cn/);

    const rows = getGzHousingPlanRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // rows 必须按 year desc 排（最新在前）
    expect(rows[0]!.year).toBeGreaterThan(rows[1]!.year);
    // 第二行（上年）数值合理
    expect(rows[1]!.approvedPresaleAreaWanSqm).toBeGreaterThan(300);
    expect(rows[1]!.approvedPresaleAreaWanSqm).toBeLessThan(800);
    expect(rows[1]!.residentialLandHa).toBeGreaterThan(100);
    expect(rows[1]!.residentialLandHa).toBeLessThan(700);
    expect(rows[1]!.approvedPresaleUnitsWan).toBeGreaterThan(0);
    expect(rows[1]!.approvedPresaleUnitsWan).toBeLessThan(10);
  });

  it("同比：预售面积与用地可对上年差分", () => {
    const yoy = getGzHousingPlanYoY();
    expect(yoy).not.toBeNull();
    // v1.122.29 修：prev.year 不能硬编码 2025（明年补 2027 后 prev=2026）
    // 改用 regex 兼容任何 2020+ 年度
    expect(yoy!.prev.year).toBeGreaterThanOrEqual(2020);
    // 差分 = rows[0] - rows[1]（rows 按 year desc 排，yoy.prev = rows[1]）
    const rows = getGzHousingPlanRows();
    expect(yoy!.areaDeltaWan).toBeCloseTo(
      rows[0]!.approvedPresaleAreaWanSqm - rows[1]!.approvedPresaleAreaWanSqm,
      5
    );
    expect(yoy!.landDeltaHa).toBeCloseTo(
      rows[0]!.residentialLandHa - rows[1]!.residentialLandHa,
      5
    );
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
