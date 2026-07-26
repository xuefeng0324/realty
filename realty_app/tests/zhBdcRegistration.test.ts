import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatZhBdcPeriod,
  getLatestZhBdcByKind,
  getZhBdcDistrictsFor,
  getZhBdcRegistrationRows,
  getZhBdcResidentialQoQ,
  loadZhBdcRegistrationFromCSV,
  sumZhBdcDistrictResidential,
  zhBdcMetricLabel
} from "../src/local/zhBdcRegistration";

describe("zh bdc registration (curated quarterly)", () => {
  it("加载珠海不动产登记季报合计样本", () => {
    const rows = getZhBdcRegistrationRows();
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows.every((r) => r.city === "珠海")).toBe(true);
    const kinds = new Set(rows.map((r) => r.metricKind));
    expect(kinds.has("new_commodity")).toBe(true);
    expect(kinds.has("stock_transfer")).toBe(true);

    const latestNew = getLatestZhBdcByKind("new_commodity");
    expect(latestNew).not.toBeNull();
    expect(latestNew!.year).toBe(2026);
    expect(latestNew!.quarter).toBe(2);
    expect(latestNew!.residentialUnits).toBe(3933);
    expect(latestNew!.residentialAreaWanSqm).toBeCloseTo(42.37, 2);
    expect(latestNew!.sourceUrl).toMatch(/bdc\.zhuhai\.gov\.cn/);
    expect(latestNew!.imageUrl).toMatch(/\.png$/);
    expect(formatZhBdcPeriod(latestNew!)).toBe("2026 年 Q2");
    expect(zhBdcMetricLabel("new_commodity")).toContain("新增商品房");

    const latestStock = getLatestZhBdcByKind("stock_transfer");
    expect(latestStock!.residentialUnits).toBe(7833);
    expect(latestStock!.residentialAreaWanSqm).toBeCloseTo(81.4, 2);
  });

  it("相邻季住宅套数环比可算", () => {
    const qoqNew = getZhBdcResidentialQoQ("new_commodity");
    expect(qoqNew).not.toBeNull();
    expect(qoqNew!.prev.year).toBe(2026);
    expect(qoqNew!.prev.quarter).toBe(1);
    expect(qoqNew!.unitsDelta).toBe(3933 - 2875);

    const qoqStock = getZhBdcResidentialQoQ("stock_transfer");
    expect(qoqStock).not.toBeNull();
    expect(qoqStock!.unitsDelta).toBe(7833 - 6219);
  });

  it("最新季分区明细合计对齐全市", () => {
    const latestNew = getLatestZhBdcByKind("new_commodity")!;
    const latestStock = getLatestZhBdcByKind("stock_transfer")!;
    const newD = getZhBdcDistrictsFor(latestNew, "new_commodity");
    const stockD = getZhBdcDistrictsFor(latestStock, "stock_transfer");
    expect(newD.length).toBe(5);
    expect(stockD.length).toBe(5);
    expect(sumZhBdcDistrictResidential(newD)).toBe(latestNew.residentialUnits);
    expect(sumZhBdcDistrictResidential(stockD)).toBe(latestStock.residentialUnits);
  });

  it("2025Q1–2026Q2 各季分区行齐全且对齐全市合计", () => {
    const rows = getZhBdcRegistrationRows();
    expect(rows.length).toBeGreaterThanOrEqual(12);
    for (const cityRow of rows) {
      const d = getZhBdcDistrictsFor(cityRow);
      expect(d.length).toBe(5);
      expect(sumZhBdcDistrictResidential(d)).toBe(cityRow.residentialUnits);
    }
  });

  it("CSV 可重解析；仪表盘有卡；列表脚本存在", () => {
    const text = readFileSync(resolve(process.cwd(), "static/zh_bdc_registration.csv"), "utf8");
    const rows = loadZhBdcRegistrationFromCSV(text);
    expect(rows.length).toBe(getZhBdcRegistrationRows().length);
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-zh-bdc-registration");
    const script = readFileSync(resolve(process.cwd(), "scripts/list_zh_bdc_registration_posts.py"), "utf8");
    expect(script).toContain("bdc.zhuhai.gov.cn");
    expect(script).toContain("zh_bdc_registration.csv");
  });

  it("脚注口径不含日更网签/挂牌均价误导", () => {
    const latest = getLatestZhBdcByKind("new_commodity")!;
    expect(latest.note).toMatch(/非日更网签/);
    expect(latest.note).toMatch(/非挂牌均价/);
  });
});
