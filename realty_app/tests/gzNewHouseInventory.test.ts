import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getGzInventoryDayDelta,
  getGzInventoryOverview,
  gzInventoryHasNonResidential,
  loadGzInventoryFromCSV,
  topDistrictAvailableSharePct,
  districtAvailableSharePct
} from "../src/local/gzNewHouseInventory";

describe("广州新房库存", () => {
  it("解析并按可售套数排序，同时汇总城市总量", () => {
    loadGzInventoryFromCSV(
      [
        "date,district,available_units,available_area_sqm,unsold_units,unsold_area_sqm,signed_units,signed_area_sqm,source_url",
        "2026-07-23,天河区,100,12000,300,36000,5,600,https://example.com",
        "2026-07-23,增城区,250,28000,500,58000,8,900,https://example.com",
        "2026-07-22,增城区,999,28000,999,58000,99,900,https://example.com"
      ].join("\n")
    );

    const overview = getGzInventoryOverview();
    expect(overview?.availableUnits).toBe(350);
    expect(overview?.unsoldUnits).toBe(800);
    expect(overview?.signedUnits).toBe(13);
    expect(overview?.districts[0].district).toBe("增城区");
    expect(topDistrictAvailableSharePct(overview)).toBe(71.4);
    expect(districtAvailableSharePct(overview!.districts[1], overview!.availableUnits)).toBe(28.6);
    expect(gzInventoryHasNonResidential(overview)).toBe(false);
  });

  it("解析商业/办公/车位分项并汇总", () => {
    loadGzInventoryFromCSV(
      [
        "date,district,available_units,available_area_sqm,unsold_units,unsold_area_sqm,signed_units,signed_area_sqm,available_commercial_units,available_commercial_area_sqm,unsold_commercial_units,unsold_commercial_area_sqm,signed_commercial_units,signed_commercial_area_sqm,available_office_units,available_office_area_sqm,unsold_office_units,unsold_office_area_sqm,signed_office_units,signed_office_area_sqm,available_parking_units,available_parking_area_sqm,unsold_parking_units,unsold_parking_area_sqm,signed_parking_units,signed_parking_area_sqm,source_url",
        "2026-07-27,天河区,100,1,200,1,10,1,20,1,40,1,1,1,30,1,50,1,2,1,500,1,800,1,3,1,https://example.com",
        "2026-07-27,增城区,50,1,100,1,5,1,10,1,20,1,0,1,15,1,25,1,1,1,200,1,400,1,0,1,https://example.com"
      ].join("\n")
    );
    const overview = getGzInventoryOverview();
    expect(overview?.availableUnits).toBe(150);
    expect(overview?.availableCommercialUnits).toBe(30);
    expect(overview?.availableOfficeUnits).toBe(45);
    expect(overview?.availableParkingUnits).toBe(700);
    expect(overview?.unsoldCommercialUnits).toBe(60);
    expect(overview?.signedOfficeUnits).toBe(3);
    expect(gzInventoryHasNonResidential(overview)).toBe(true);
  });

  it("日环比：最新日 vs 上一交易日全市总量差", () => {
    loadGzInventoryFromCSV(
      [
        "date,district,available_units,available_area_sqm,unsold_units,unsold_area_sqm,signed_units,signed_area_sqm,source_url",
        "2026-07-22,天河区,100,1,200,1,10,1,https://example.com",
        "2026-07-23,天河区,110,1,190,1,12,1,https://example.com"
      ].join("\n")
    );
    const delta = getGzInventoryDayDelta();
    expect(delta?.prevDate).toBe("2026-07-22");
    expect(delta?.availableDelta).toBe(10);
    expect(delta?.unsoldDelta).toBe(-10);
    expect(delta?.signedDelta).toBe(2);
    // 历史无非住宅列时，不报虚假业态环比
    expect(delta?.availableCommercialDelta).toBe(0);
  });

  it("内置官方快照覆盖广州 11 区且含非住宅业态", () => {
    const csv = readFileSync(resolve(process.cwd(), "static/gz_new_house_inventory.csv"), "utf8");
    const loaded = loadGzInventoryFromCSV(csv);
    const latest = getGzInventoryOverview();
    expect(latest?.districts).toHaveLength(11);
    expect(new Set(latest?.districts.map((row) => row.district)).size).toBe(11);
    expect(latest?.availableUnits).toBeGreaterThan(0);
    expect(latest?.unsoldUnits).toBeGreaterThan(latest?.availableUnits ?? 0);
    expect(latest?.sourceUrl).toContain("zfcj.gz.gov.cn");
    expect(latest?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(gzInventoryHasNonResidential(latest)).toBe(true);
    expect(latest?.availableCommercialUnits).toBeGreaterThan(0);
    expect(latest?.availableOfficeUnits).toBeGreaterThan(0);
    expect(latest?.availableParkingUnits).toBeGreaterThan(0);
    expect(
      loaded.every((row) => row.availableUnits >= 0 && row.unsoldUnits >= 0 && row.signedUnits >= 0)
    ).toBe(true);
    const delta = getGzInventoryDayDelta();
    expect(delta).not.toBeNull();
    expect(delta?.prevDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
