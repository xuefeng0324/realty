import { describe, expect, it, beforeEach } from "vitest";
import {
  loadDailyWangqianFromCSV,
  getLatestCityDaily,
  getCityDailyTrend,
  getLatestDistrictBreakdown,
  getLatestMonthlyDeal,
  getWangqianDistrictNames
} from "../src/local/dailyWangqian";
import { setDailyWangqian } from "../src/local/store";

const TREND = "https://fdc.zjj.sz.gov.cn/public/marketInfo/housePriceTrendInfo.html";
const PUB = "http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/";

const SAMPLE = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-06-29,深圳,新房,住宅,全市,80,14000.00,city,${TREND}
2026-06-29,深圳,二手,住宅,全市,200,20000.00,city,${TREND}
2026-06-30,深圳,新房,住宅,全市,84,14996.48,city,${TREND}
2026-06-30,深圳,二手,住宅,全市,222,21237.62,city,${TREND}
2026-06-30,广州,新房,住宅,全市,741,73183.35,city,https://zfcj.gz.gov.cn/
`;

describe("dailyWangqian parser", () => {
  beforeEach(() => {
    setDailyWangqian([]);
  });

  it("parses city-level residential snapshots", () => {
    const rows = loadDailyWangqianFromCSV(SAMPLE);
    expect(rows.length).toBe(5);
    const sz = getLatestCityDaily("深圳");
    expect(sz?.date).toBe("2026-06-30");
    expect(sz?.newUnits).toBe(84);
    expect(sz?.secondResidentialUnits).toBe(222);
  });

  it("builds trend series (residential)", () => {
    loadDailyWangqianFromCSV(SAMPLE);
    const trend = getCityDailyTrend("深圳", 14, "新房");
    expect(trend.map((p) => p.units)).toEqual([80, 84]);
  });

  it("keeps residential (188) and all (239) second-hand separate", () => {
    const csv = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-07-01,深圳,二手,住宅,全市,188,19249.37,city,${TREND}
2026-07-01,深圳,二手,全部,全市,239,22764.62,city,${PUB}
2026-07-01,深圳,新房,住宅,全市,70,8571.17,city,${TREND}
`;
    loadDailyWangqianFromCSV(csv);
    const sz = getLatestCityDaily("深圳");
    expect(sz?.secondResidentialUnits).toBe(188);
    expect(sz?.secondAllUnits).toBe(239);
    expect(sz?.newUnits).toBe(70);
    const trend = getCityDailyTrend("深圳", 5, "二手");
    expect(trend[trend.length - 1].units).toBe(188);
  });

  it("infers scope from legacy CSV without a scope column", () => {
    const legacy = `date,city,category,district,units,area_sqm,granularity,source_url
2026-07-01,深圳,二手,全市,188,19249.37,city,${TREND}
2026-07-01,深圳,新房,全市,70,8571.17,city,${TREND}
`;
    loadDailyWangqianFromCSV(legacy);
    const sz = getLatestCityDaily("深圳");
    expect(sz?.secondResidentialUnits).toBe(188);
  });

  it("builds district breakdown for latest day", () => {
    const csv = SAMPLE + `2026-06-30,深圳,新房,住宅,南山,10,1000.00,district,${PUB}
2026-06-30,深圳,二手,全部,南山,20,2000.00,district,${PUB}
2026-06-30,深圳,新房,住宅,福田,5,500.00,district,${PUB}
`;
    loadDailyWangqianFromCSV(csv);
    const br = getLatestDistrictBreakdown("深圳");
    expect(br?.date).toBe("2026-06-30");
    expect(br?.rows.length).toBe(2);
    const ns = br?.rows.find((r) => r.district === "南山");
    expect(ns?.newUnits).toBe(10);
    expect(ns?.secondUnits).toBe(20);
  });

  it("exposes non-residential second-hand gap (全部 − 住宅)", () => {
    const csv = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-07-01,深圳,二手,住宅,全市,188,19249.37,city,${TREND}
2026-07-01,深圳,二手,全部,全市,239,22764.62,city,${PUB}
2026-07-01,深圳,新房,住宅,全市,70,8571.17,city,${TREND}
2026-07-01,深圳,新房,住宅,南山,14,1000.00,district,${PUB}
2026-07-01,深圳,二手,全部,南山,29,1000.00,district,${PUB}
2026-07-01,深圳,新房,住宅,福田,56,100.00,district,${PUB}
2026-07-01,深圳,二手,全部,福田,210,100.00,district,${PUB}
`;
    loadDailyWangqianFromCSV(csv);
    const br = getLatestDistrictBreakdown("深圳");
    expect(br?.citySecondResidentialUnits).toBe(188);
    expect(br?.citySecondAllUnits).toBe(239);
    expect(br?.secondNonResidentialUnits).toBe(51);
    expect(br?.districtSecondSum).toBe(239);
    expect(br?.districtNewSum).toBe(70);
  });

  it("parses monthly deal (month / month_district)", () => {
    const csv = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-06-01,深圳,新房,住宅,全市,2413,282673.22,month,${PUB}
2026-06-01,深圳,二手,全部,全市,6214,592736.06,month,${PUB}
2026-06-01,深圳,新房,住宅,南山,282,30000.00,month_district,${PUB}
2026-06-01,深圳,二手,全部,南山,993,90000.00,month_district,${PUB}
2026-06-01,深圳,新房,住宅,福田,60,7000.00,month_district,${PUB}
2026-06-01,深圳,二手,全部,福田,1129,100000.00,month_district,${PUB}
`;
    loadDailyWangqianFromCSV(csv);
    const m = getLatestMonthlyDeal("深圳");
    expect(m?.month).toBe("2026-06");
    expect(m?.newUnits).toBe(2413);
    expect(m?.secondUnits).toBe(6214);
    expect(m?.districts.length).toBe(2);
    const ns = m?.districts.find((d) => d.district === "南山");
    expect(ns?.newUnits).toBe(282);
    expect(ns?.secondUnits).toBe(993);
  });

  it("lists government district names (strips 区 suffix)", () => {
    const csv = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-07-01,深圳,二手,全部,南山,29,1000.00,district,${PUB}
2026-07-01,深圳,二手,全部,坪山,7,500.00,district,${PUB}
2026-06-01,深圳,新房,住宅,光明,10,900.00,month_district,${PUB}
`;
    loadDailyWangqianFromCSV(csv);
    const names = getWangqianDistrictNames("深圳市");
    expect(names).toContain("南山");
    expect(names).toContain("坪山");
    expect(names).toContain("光明");
  });
});
