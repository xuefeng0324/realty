import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLatestZhAffordableProgress,
  getZhAffordableProgressMoM,
  getZhAffordableProgressRows,
  loadZhAffordableProgressFromCSV
} from "../src/local/zhAffordableProgress";

describe("zh affordable progress", () => {
  it("加载珠海安居工程进展快报样本", () => {
    const rows = getZhAffordableProgressRows();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.city === "珠海")).toBe(true);
    const latest = getLatestZhAffordableProgress();
    expect(latest).not.toBeNull();
    expect(latest!.completedUnits).toBeGreaterThan(0);
    expect(latest!.sourceUrl).toMatch(/zjj\.zhuhai\.gov\.cn/);
    expect(latest!.attachmentUrl).toMatch(/\.xls/i);
  });

  it("同年环比可算；跨年不在加载层伪造", () => {
    const rows = getZhAffordableProgressRows();
    const mom = getZhAffordableProgressMoM();
    if (rows.length >= 2 && rows[0]!.year === rows[1]!.year) {
      expect(mom).not.toBeNull();
      expect(mom!.startedDelta).toBe(rows[0]!.startedUnits - rows[1]!.startedUnits);
    }
  });

  it("爬虫依赖 xlrd；仪表盘有卡", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_zh_affordable_progress.py"), "utf8");
    expect(script).toContain("zjj.zhuhai.gov.cn");
    expect(script).toContain("保障性安居工程建设进展情况快报表");
    expect(script).toContain("1-11总计");
    expect(script).toContain("xlrd");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-zh-affordable-progress");
    expect(dash).toContain("getLatestZhAffordableProgress");
  });

  it("分业态字段：保租房/配售型/公租房", () => {
    const latest = getLatestZhAffordableProgress();
    expect(latest).not.toBeNull();
    expect(latest!.protectedRentalStartedUnits).toBeGreaterThanOrEqual(0);
    expect(latest!.protectedRentalCompletedUnits).toBeGreaterThan(0);
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_zh_affordable_progress.py"), "utf8");
    expect(script).toContain("protected_rental_started_units");
    expect(script).toContain("配售型保障性住房");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("protectedRentalStartedUnits");
    expect(dash).toContain("saleTypeStartedUnits");
  });

  it("CSV 解析", () => {
    const rows = loadZhAffordableProgressFromCSV(
      [
        "city,year,month,report_date,plan_invest_wan,started_units,started_area_sqm,basically_completed_units,basically_completed_area_sqm,completed_units,completed_area_sqm,rental_subsidy_households,public_rental_started_units,public_rental_completed_units,sale_type_started_units,sale_type_completed_units,protected_rental_started_units,protected_rental_completed_units,source_org,source_url,attachment_url",
        "珠海,2099,6,2099-06-30,1,10,100,20,200,30,300,5,1,2,3,4,6,7,珠海市住建局,https://zjj.zhuhai.gov.cn/a,https://zjj.zhuhai.gov.cn/a.xls"
      ].join("\n")
    );
    expect(rows[0]!.startedUnits).toBe(10);
    expect(rows[0]!.protectedRentalStartedUnits).toBe(6);
  });
});
