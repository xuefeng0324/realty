import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getZhPriceFilingRows,
  getZhPriceFilingSummary,
  inferZhFilingDistrict,
  loadZhPriceFilingFromCSV,
  __setZhPriceFilingForTest
} from "../src/local/zhPriceFiling";

describe("zh price filing", () => {
  it("加载珠海价格备案样本", () => {
    const rows = getZhPriceFilingRows();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.postId)).toBe(true);
    expect(rows.every((r) => r.district)).toBe(true);
    const summary = getZhPriceFilingSummary();
    expect(summary).not.toBeNull();
    expect(summary!.filingCount).toBe(rows.length);
    expect(summary!.totalUnits).toBeGreaterThan(0);
    expect(summary!.medianAvgPriceBuilding).toBeGreaterThan(0);
    expect(summary!.districtStats.length).toBeGreaterThan(0);
    expect(rows[0]!.sourceUrl).toMatch(/zjj\.zhuhai\.gov\.cn/);
  });

  it("地址推断分区", () => {
    expect(inferZhFilingDistrict("珠海市香洲区某某路1号")).toBe("香洲区");
    expect(inferZhFilingDistrict("珠海市斗门区某某路")).toBe("斗门区");
    expect(inferZhFilingDistrict("珠海市高新区前岛环路")).toBe("高新区");
    expect(inferZhFilingDistrict("未知地址")).toBe("其他");
  });

  it("爬虫与仪表盘接线", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/crawl_zh_price_filing.py"), "utf8");
    expect(script).toContain("spfjgbags");
    expect(script).toContain("avg_price_building");
    expect(script).toContain("infer_district");
    expect(script).toContain("销售价格备案");
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-zh-price-filing");
    expect(dash).toContain("getZhPriceFilingSummary");
    expect(dash).toContain("备案价 ≠ 挂牌价");
    expect(dash).toContain("districtStats");
  });

  it("CSV 解析与中位价 / 加权", () => {
    const rows = loadZhPriceFilingFromCSV(
      [
        "post_id,publish_date,updated_date,project_name,address,units,area_sqm,avg_price_building,avg_price_inner,list_title,source_org,source_url",
        "1,2099-01-02,2099-01-01,甲,珠海市香洲区A,10,100,20000,25000,t,org,https://zjj.zhuhai.gov.cn/a",
        "2,2099-01-03,2099-01-01,乙,珠海市斗门区B,5,50,30000,35000,t,org,https://zjj.zhuhai.gov.cn/b",
        "3,2099-01-04,2099-01-01,丙,珠海市金湾区C,8,80,10000,12000,t,org,https://zjj.zhuhai.gov.cn/c"
      ].join("\n")
    );
    expect(rows[0]!.projectName).toBe("丙");
    expect(rows[0]!.district).toBe("金湾区");
    __setZhPriceFilingForTest(rows);
    const summary = getZhPriceFilingSummary(2);
    expect(summary!.filingCount).toBe(3);
    expect(summary!.totalUnits).toBe(23);
    expect(summary!.medianAvgPriceBuilding).toBe(20000);
    expect(summary!.weightedAvgPriceBuilding).toBe(
      Math.round(((20000 * 10 + 30000 * 5 + 10000 * 8) / 23) * 100) / 100
    );
    expect(summary!.districtStats.length).toBe(3);
    expect(summary!.recent).toHaveLength(2);
    const text = readFileSync(resolve(process.cwd(), "static/zh_price_filing.csv"), "utf8");
    __setZhPriceFilingForTest(loadZhPriceFilingFromCSV(text));
  });
});
