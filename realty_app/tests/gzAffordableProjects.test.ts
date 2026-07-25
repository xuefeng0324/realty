import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzAffordableProjectsRows,
  getLatestGzAffordableCompleted,
  getLatestGzAffordableRaised,
  getLatestGzAffordableShantytownCompleted,
  loadGzAffordableProjectsFromCSV
} from "../src/local/gzAffordableProjects";

describe("gz affordable projects", () => {
  it("加载广州保障房已筹建/已竣工汇总", () => {
    const rows = getGzAffordableProjectsRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.city === "广州")).toBe(true);
    const raised = getLatestGzAffordableRaised();
    expect(raised).not.toBeNull();
    expect(raised!.kind).toBe("raised");
    expect(raised!.totalUnits).toBeGreaterThan(0);
    expect(raised!.attachmentUrl).toMatch(/\.xls/i);
    // 无偏好时仍可取到保障房竣工（不优先棚改）
    const doneAny = getLatestGzAffordableCompleted();
    expect(doneAny).not.toBeNull();
    expect(doneAny!.kind).toBe("completed");
    expect(doneAny!.category).not.toContain("棚户");
  });

  it("已竣工与已筹建同口径：不把棚改并到配售型旁", () => {
    const raised = getLatestGzAffordableRaised();
    expect(raised).not.toBeNull();
    expect(raised!.category).toContain("配售型");
    const aligned = getLatestGzAffordableCompleted({
      preferYear: raised!.year,
      preferCategory: raised!.category
    });
    // 2025 配售型尚无同族同年竣工清单 → 隐藏竣工 KPI
    expect(aligned).toBeNull();
    const shanty = getLatestGzAffordableShantytownCompleted(raised!.year);
    expect(shanty).not.toBeNull();
    expect(shanty!.category).toContain("棚户");
    expect(shanty!.totalUnits).toBe(10652);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_affordable_projects.py"), "utf8");
    expect(script).toContain("zfcj.gz.gov.cn");
    expect(script).toContain("bzxzfxm");
    expect(script).toContain("建设套数");
    expect(script).toContain("xlrd");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-gz-affordable-projects");
    expect(dash).toContain("getLatestGzAffordableRaised");
    expect(dash).toContain("gz-progress-track");
    expect(dash).toContain("preferCategory");
    expect(dash).toContain("data-gz-affordable-shanty-note");
    expect(dash).toContain("getNbsImpliedUnitPriceTrend");
    expect(dash).toContain("getNbsImpliedInventoryMonths");
    expect(dash).toContain("getNbsImpliedInventoryMonthsTrend");
    expect(dash).toContain("data-nbs-series-toggle");
    expect(dash).toContain("销售额同比（多期）");
    expect(dash).toContain("到位资金同比（多期）");
  });

  it("CSV 解析", () => {
    const rows = loadGzAffordableProjectsFromCSV(
      [
        "city,year,as_of_month,kind,category,project_count,total_units,title,source_org,source_url,attachment_url",
        "广州,2099,9,raised,配售型保障性住房,2,100,测试,广州市住建局,https://zfcj.gz.gov.cn/a,https://zfcj.gz.gov.cn/a.xls"
      ].join("\n")
    );
    expect(rows[0]!.totalUnits).toBe(100);
  });
});
