import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  educationHasPrimaryJuniorSplit,
  getEducationOverview,
  getEducationOverviews
} from "../src/local/educationOverview";

describe("official education overview", () => {
  it("加载广州2025年教育事业统计公报核心数据", () => {
    const row = getEducationOverview("广州");
    expect(row).not.toBeNull();
    expect(row?.period).toBe("2025");
    expect(row?.totalSchools).toBe(3806);
    expect(row?.totalStudents10k).toBe(292.63);
    expect(row?.primaryCount + row?.juniorHighCount).toBe(row?.compulsoryCount);
    expect(educationHasPrimaryJuniorSplit(row!)).toBe(true);
  });

  it("加载深圳2025年教育事业发展基本情况（普通中小学口径）", () => {
    const row = getEducationOverview("深圳");
    expect(row).not.toBeNull();
    expect(row?.period).toBe("2025");
    expect(row?.totalSchools).toBe(2996);
    expect(row?.totalStudents10k).toBe(287.41);
    expect(row?.compulsoryCount).toBe(960);
    expect(row?.kindergartenCount).toBe(1977);
    expect(row?.privateCount).toBe(1193);
    expect(row?.primaryCount).toBe(0);
    expect(row?.juniorHighCount).toBe(0);
    expect(educationHasPrimaryJuniorSplit(row!)).toBe(false);
    expect(row?.sourceOrg).toBe("深圳市教育局");
    expect(row?.sourceUrl).toMatch(/^https:\/\/szeb\.sz\.gov\.cn\//);
    expect(row?.publishDate).toBe("2026-05-13");
  });

  it("加载珠海2024-2025学年基础教育学校数官方表", () => {
    const row = getEducationOverview("珠海");
    expect(row).not.toBeNull();
    expect(row?.period).toBe("2024");
    expect(row?.totalSchools).toBe(703);
    expect(row?.kindergartenCount).toBe(432);
    expect(row?.primaryCount).toBe(155);
    expect(row?.juniorHighCount).toBe(88);
    expect(row?.seniorHighCount).toBe(23);
    expect(row?.specialCount).toBe(4);
    expect(row?.compulsoryCount).toBe(243);
    expect(row?.totalStudents10k).toBe(0);
    expect(row?.vocationalCount).toBe(0);
    expect(row?.privateCount).toBe(0);
    expect(educationHasPrimaryJuniorSplit(row!)).toBe(true);
    expect(row?.sourceOrg).toBe("珠海市教育局");
    expect(row?.sourceUrl).toMatch(/^https:\/\/www\.zhuhai\.gov\.cn\//);
    expect(row?.publishDate).toBe("2025-06-16");
  });

  it("来源必须是教育局官方 HTTPS，且含广深珠三城", () => {
    const rows = getEducationOverviews();
    expect(rows.map((r) => r.city).sort()).toEqual(["广州", "深圳", "珠海"]);
    const gz = rows.find((r) => r.city === "广州")!;
    expect(gz.sourceOrg).toBe("广州市教育局");
    expect(gz.sourceUrl).toMatch(/^https:\/\/jyj\.gz\.gov\.cn\//);
  });

  it("广州抓取脚本具备官方域名、字段完整性和分项关系保护", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_education_overview.py"), "utf8");
    expect(script).toContain('SOURCE_HOST = "jyj.gz.gov.cn"');
    expect(script).toContain("广州教育公报缺少字段");
    expect(script).toContain("小学与初中数量之和不等于义务教育学校数");
    expect(script).toContain("NamedTemporaryFile");
  });

  it("深圳抓取脚本仅认 szeb.sz.gov.cn 且不伪造小学初中分项", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_sz_education_overview.py"), "utf8");
    expect(script).toContain("szeb.sz.gov.cn");
    expect(script).toContain("普通中小学");
    expect(script).toContain('"primary_count": 0');
    expect(script).toContain("NamedTemporaryFile");
  });

  it("珠海抓取脚本解析官方 XLSX 且不伪造在校生", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_zh_education_overview.py"), "utf8");
    expect(script).toContain("www.zhuhai.gov.cn");
    expect(script).toContain("基础教育学校数");
    expect(script).toContain('"total_students_10k": 0');
    expect(script).toContain("总计校验失败");
  });

  it("周任务会刷新广深珠教育概览快照", () => {
    const workflow = readFileSync(resolve(process.cwd(), "../.github/workflows/crawl-weekly.yml"), "utf8");
    expect(workflow).toContain("python scripts/crawl_gz_education_overview.py");
    expect(workflow).toContain("python scripts/crawl_sz_education_overview.py");
    expect(workflow).toContain("python scripts/crawl_zh_education_overview.py");
    expect(workflow).toContain("static/education_overview.csv");
  });
});
