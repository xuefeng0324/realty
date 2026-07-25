import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestSzAffordableCompleted,
  getLatestSzAffordableRaised,
  getSzAffordableProjectsRows,
  loadSzAffordableProjectsFromCSV
} from "../src/local/szAffordableProjects";

describe("sz affordable projects", () => {
  it("加载深圳保障房筹集/建成汇总", () => {
    const rows = getSzAffordableProjectsRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.city === "深圳")).toBe(true);
    const raised = getLatestSzAffordableRaised();
    expect(raised).not.toBeNull();
    expect(raised!.kind).toBe("raised");
    expect(raised!.totalUnits).toBeGreaterThan(1000);
    expect(raised!.sourceUrl).toMatch(/zjj\.sz\.gov\.cn/);
    const done = getLatestSzAffordableCompleted();
    expect(done).not.toBeNull();
    expect(done!.kind).toBe("completed");
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_sz_affordable_projects.py"), "utf8");
    expect(script).toContain("zjj.sz.gov.cn");
    expect(script).toContain("pypdf");
    expect(script).toContain("_ensure_pil_stub");
    expect(script).toContain("UNIT_RE");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-sz-affordable-projects");
    expect(dash).toContain("getLatestSzAffordableRaised");
  });

  it("CSV 解析", () => {
    const rows = loadSzAffordableProjectsFromCSV(
      [
        "city,year,kind,category,project_count,total_units,title,source_org,source_url",
        "深圳,2099,raised,保障性住房,2,100,测试,深圳市住建局,https://zjj.sz.gov.cn/a.pdf"
      ].join("\n")
    );
    expect(rows[0]!.totalUnits).toBe(100);
  });
});
