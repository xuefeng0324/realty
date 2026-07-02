import { describe, expect, it, beforeEach } from "vitest";
import { loadDailyWangqianFromCSV, getLatestCityDaily, getCityDailyTrend, getLatestDistrictBreakdown } from "../src/local/dailyWangqian";
import { setDailyWangqian } from "../src/local/store";

const SAMPLE = `date,city,category,district,units,area_sqm,granularity,source_url
2026-06-29,深圳,新房,全市,80,14000.00,city,http://example/
2026-06-29,深圳,二手,全市,200,20000.00,city,http://example/
2026-06-30,深圳,新房,全市,84,14996.48,city,http://example/
2026-06-30,深圳,二手,全市,222,21237.62,city,http://example/
2026-06-30,广州,新房,全市,741,73183.35,city,http://example/
`;

describe("dailyWangqian parser", () => {
  beforeEach(() => {
    setDailyWangqian([]);
  });

  it("parses city-level snapshots", () => {
    const rows = loadDailyWangqianFromCSV(SAMPLE);
    expect(rows.length).toBe(5);
    const sz = getLatestCityDaily("深圳");
    expect(sz?.date).toBe("2026-06-30");
    expect(sz?.newUnits).toBe(84);
    expect(sz?.secondUnits).toBe(222);
  });

  it("builds trend series", () => {
    loadDailyWangqianFromCSV(SAMPLE);
    const trend = getCityDailyTrend("深圳", 14, "新房");
    expect(trend.map((p) => p.units)).toEqual([80, 84]);
  });

  it("builds district breakdown for latest day", () => {
    const csv = SAMPLE + `2026-06-30,深圳,新房,南山,10,1000.00,district,http://example/
2026-06-30,深圳,二手,南山,20,2000.00,district,http://example/
2026-06-30,深圳,新房,福田,5,500.00,district,http://example/
`;
    loadDailyWangqianFromCSV(csv);
    const br = getLatestDistrictBreakdown("深圳");
    expect(br?.date).toBe("2026-06-30");
    expect(br?.rows.length).toBe(2);
    const ns = br?.rows.find((r) => r.district === "南山");
    expect(ns?.newUnits).toBe(10);
    expect(ns?.secondUnits).toBe(20);
  });
});
