import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getEducationOverview, getEducationOverviews } from "../src/local/educationOverview";

describe("official education overview", () => {
  it("加载广州2025年教育事业统计公报核心数据", () => {
    const row = getEducationOverview("广州");
    expect(row).not.toBeNull();
    expect(row?.period).toBe("2025");
    expect(row?.totalSchools).toBe(3806);
    expect(row?.totalStudents10k).toBe(292.63);
    expect(row?.primaryCount + row?.juniorHighCount).toBe(row?.compulsoryCount);
  });

  it("来源必须是广州教育局官方HTTPS页面", () => {
    const rows = getEducationOverviews();
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceOrg).toBe("广州市教育局");
    expect(rows[0].sourceUrl).toMatch(/^https:\/\/jyj\.gz\.gov\.cn\//);
    expect(rows[0].publishDate).toBe("2026-06-15");
  });

  it("未接入官方公报的城市不生成替代数据", () => {
    expect(getEducationOverview("深圳")).toBeNull();
    expect(getEducationOverview("珠海")).toBeNull();
  });

  it("抓取脚本具备官方域名、字段完整性和分项关系保护", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_education_overview.py"), "utf8");
    expect(script).toContain('SOURCE_HOST = "jyj.gz.gov.cn"');
    expect(script).toContain("广州教育公报缺少字段");
    expect(script).toContain("小学与初中数量之和不等于义务教育学校数");
    expect(script).toContain("NamedTemporaryFile");
  });

  it("周任务会刷新并提交教育概览快照", () => {
    const workflow = readFileSync(resolve(process.cwd(), "../.github/workflows/crawl-weekly.yml"), "utf8");
    expect(workflow).toContain("python scripts/crawl_gz_education_overview.py");
    expect(workflow).toContain("static/education_overview.csv");
  });
});
