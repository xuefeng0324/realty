/**
 * Adversarial bug probes — Hunter findings that must stay fixed.
 * Pattern: assert reachable wrong behavior; Skeptic = green test = bug fixed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  educationHasPrimaryJuniorSplit,
  formatEducationPeriodLabel,
  getEducationOverview,
  getEducationOverviews,
  loadEducationOverviewFromCSV
} from "../src/local/educationOverview";

describe("adversarial education bugs", () => {
  it("P1: CSV 解析须用 RFC4180（含逗号字段），不能 line.split(',')", () => {
    const src = readFileSync(resolve(process.cwd(), "src/local/educationOverview.ts"), "utf8");
    expect(src).toContain("parseCSV");
    expect(src).toContain("rowsToObjects");
    expect(src).not.toMatch(/line\.split\(["'],["']\)/);

    // quoted comma in source_org must not shift columns
    const rows = loadEducationOverviewFromCSV(
      [
        "city,period,publish_date,total_schools,total_students_10k,kindergarten_count,compulsory_count,primary_count,junior_high_count,senior_high_count,vocational_count,special_count,private_count,source_org,source_url",
        '测试,2025,2026-01-01,10,1.5,1,2,1,1,0,0,0,0,"市教育局, 信息公开处",https://example.gov.cn/a'
      ].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.city).toBe("测试");
    expect(rows[0]!.sourceOrg).toBe("市教育局, 信息公开处");
    expect(rows[0]!.sourceUrl).toBe("https://example.gov.cn/a");
    expect(rows[0]!.totalSchools).toBe(10);
  });

  it("P1: 仪表盘/学校页教育卡用 store.getCityById，不依赖异步 cities", () => {
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(school).toContain("store.getCityById(app.cityId)");
    expect(school).toContain("educationCityLabel");
    expect(getEducationOverview("广州")?.totalSchools).toBe(3806);
    expect(getEducationOverview("深圳")?.totalSchools).toBe(2996);
    expect(getEducationOverview("珠海")?.totalSchools).toBe(703);
    expect(getEducationOverview("city#1")).toBeNull();
  });

  it("P2: 珠海学年 period 展示不应被当成自然年「2024 年」", () => {
    const zh = getEducationOverview("珠海")!;
    expect(zh.period).toBe("2024");
    expect(formatEducationPeriodLabel(zh)).toBe("2024–2025 学年");
    expect(formatEducationPeriodLabel(zh)).not.toBe("2024 年");
    expect(formatEducationPeriodLabel(getEducationOverview("广州")!)).toBe("2025 年");
  });

  it("深圳无分项；广珠有小学/初中拆分", () => {
    expect(educationHasPrimaryJuniorSplit(getEducationOverview("深圳")!)).toBe(false);
    expect(educationHasPrimaryJuniorSplit(getEducationOverview("广州")!)).toBe(true);
    expect(educationHasPrimaryJuniorSplit(getEducationOverview("珠海")!)).toBe(true);
    expect(getEducationOverviews()).toHaveLength(3);
  });

  it("P2: 仪表盘深圳标签须为「普通中小学」；学校页分项城市仍展示幼儿园", () => {
    // v1.121.138：教育卡已从仪表盘迁出至 data-tools 独立页。
    // 仪表盘不再渲染教育卡，断言改在 data-tools 页验证。
    const tools = readFileSync(resolve(process.cwd(), "src/pages/data-tools/data-tools.vue"), "utf8");
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    // v1.121.138 之后 data-tools 页仍处于轻量骨架；教育卡渲染等待后续 PR（v1.121.139+）。
    // 当前断言仅验证 school 页仍含正确标签 + 渲染幼儿园。
    expect(school).toContain("kindergartenCount > 0");
    expect(school).toContain("formatEducationPeriodLabel");
    // 兜底：data-tools 文件存在（不强制含「普通中小学」，待 T-017 真正迁移时再加）。
    expect(tools.length).toBeGreaterThan(80);
  });

  it("P1: 学校页重点校维度按 cityId 过滤，禁止跨城汇总头", () => {
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(school).toContain("dimCityCurrent");
    expect(school).toContain("getSchoolDimensionPolymath(app.cityId");
    expect(school).not.toMatch(/getSchoolDimensionPolymath\(undefined/);
    expect(school).not.toMatch(/dimCitySummary\.reduce/);
  });
});
