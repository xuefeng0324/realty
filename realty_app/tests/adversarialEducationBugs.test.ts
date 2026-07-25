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
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(dash).toMatch(/eduOverview[\s\S]*?store\.getCityById\(app\.cityId\)/);
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
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(dash).toContain("普通中小学");
    expect(dash).not.toMatch(/edu-kpi-label muted">中小学</);
    expect(school).toContain("kindergartenCount > 0");
    expect(school).toContain("formatEducationPeriodLabel");
  });
});
