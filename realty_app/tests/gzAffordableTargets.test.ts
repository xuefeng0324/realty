import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGzAffordableTargetRows,
  getLatestGzAffordableTargetCompleted,
  getLatestGzAffordableTargetRaised,
  loadGzAffordableTargetsFromCSV,
  progressPct
} from "../src/local/gzAffordableTargets";

describe("gz affordable targets", () => {
  it("加载广州保障房任务量目标进度", () => {
    const rows = getGzAffordableTargetRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.city === "广州")).toBe(true);
    const raised = getLatestGzAffordableTargetRaised();
    expect(raised).not.toBeNull();
    expect(raised!.metric).toBe("raised");
    expect(raised!.year).toBe(2024);
    expect(raised!.targetUnits).toBe(10000);
    expect(raised!.actualUnits).toBe(8351);
    expect(raised!.asOfMonth).toBe(10);
    expect(progressPct(raised)).toBe(83.5);
    const done = getLatestGzAffordableTargetCompleted();
    expect(done).not.toBeNull();
    expect(done!.targetUnits).toBe(4843);
    expect(done!.actualUnits).toBe(2811);
  });

  it("爬虫与仪表盘门禁", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_gz_affordable_targets.py"), "utf8");
    expect(script).toContain("任务量完成");
    expect(script).toContain("bzxzfxm");
    expect(script).toContain("xlrd");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("getLatestGzAffordableTargetRaised");
    expect(dash).toContain("gzAffordableTargetRaised");
  });

  it("CSV 解析", () => {
    const rows = loadGzAffordableTargetsFromCSV(
      [
        "city,year,as_of_month,metric,category,target_units,actual_units,actual_area_wan_sqm,title,source_org,source_url,attachment_url",
        "广州,2099,6,raised,配售型保障性住房,1000,800,1.2,测试,广州市住建局,https://zfcj.gz.gov.cn/a,https://zfcj.gz.gov.cn/a.xls"
      ].join("\n")
    );
    expect(rows[0]!.targetUnits).toBe(1000);
    expect(progressPct(rows[0]!)).toBe(80);
  });
});
