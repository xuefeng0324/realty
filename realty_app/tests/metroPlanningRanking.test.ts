import { describe, expect, it } from "vitest";
import {
  getMetroPlanningByCityFastLines,
  getMetroPlanningByCityStatusVsStations,
  getMetroPlanningByCityTopByLength,
  getMetroPlanningByCityTopByStations,
  getMetroPlanningByDistrict,
  getMetroPlanningByOpenYear,
  getMetroPlanningByStatus,
  getMetroPlanningCrossCityByYear,
  summarizeMetroPlanningByCity,
  summarizeMetroPlanningByOpenYear,
  summarizeMetroPlanningByPhase,
  summarizeMetroPlanningByStatus
} from "../src/local/metroPlanningRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalMetroLine } from "../src/local/types";

function emptySnapshot(): DataSnapshot {
  return {
    importedAt: "1970-01-01T00:00:00Z",
    source: "test",
    cities: [],
    communities: [],
    districts: [],
    listings: [],
    schools: [],
    indicators: [],
    districtPolygons: [],
    metroWalks: [],
    metroLines: [],
    poiClues: [],
    climate: { cities: [], globalIndex: { source: "test", updatedAt: "1970-01-01" } },
    wangqianDaily: [],
    nbsRealEstate: [],
    gzNewHouseInventory: [],
    providentFundRates: [],
    educationOverview: [],
    schoolSourceAudit: [],
    communityAliasSuggestions: [],
    districtIndices: [],
    districtMeta: [],
    index70: [],
    districtTrends: [],
    schoolIndicators: [],
    schoolDimensions: [],
    listingFreshness: [],
    listingTagSummaries: [],
    poiMarkets: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function L(
  lineId: number,
  cityId: number,
  lineName: string,
  phase: string,
  status: LocalMetroLine["status"],
  lengthKm: number | null,
  stationCount: number | null,
  startStation: string,
  endStation: string,
  maxSpeedKmh: number | null,
  openYearExpected: number | null,
  districts: string[]
): LocalMetroLine {
  return {
    lineId,
    cityId,
    lineName,
    phase,
    status,
    lengthKm,
    stationCount,
    startStation,
    endStation,
    maxSpeedKmh,
    openYearExpected,
    districts,
    notes: null
  };
}

describe("metroPlanningRanking", () => {
  it("summarizeMetroPlanningByCity 聚合 + status 分布 + 总里程", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 1, "广州线A", "广州四期", "在建", 30, 18, "x", "y", 80, 2027, ["天河区"]),
      L(2, 1, "广州线B", "广州四期", "即将开通", 10, 4, "x", "y", 80, 2026, ["番禺区"]),
      L(3, 2, "深圳线A", "深圳五期", "在建", 32.2, 24, "x", "y", 80, 2028, ["南山区"]),
      L(4, 2, "深圳线B", "深圳五期", "在建", 18.6, 18, "x", "y", 120, 2028, ["龙岗区"]) // 快线
    ];
    setSnapshot(snap);

    const sum = summarizeMetroPlanningByCity();
    expect(sum).toHaveLength(2);
    // 深圳总里程 50.8 vs 广州 40
    expect(sum[0]!.cityId).toBe(2);
    expect(sum[0]!.totalLengthKm).toBeCloseTo(50.8, 1);
    expect(sum[0]!.totalStations).toBe(42);
    expect(sum[0]!.statusDistribution["在建"]).toBe(2);

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.statusDistribution["在建"]).toBe(1);
    expect(gz.statusDistribution["即将开通"]).toBe(1);
    expect(gz.avgMaxSpeedKmh).toBe(80);
  });

  it("summarizeMetroPlanningByStatus 全国 status 聚合", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 1, "A", "广州四期", "在建", 30, 18, "x", "y", 80, 2027, ["天河区"]),
      L(2, 2, "B", "深圳五期", "在建", 18, 18, "x", "y", 80, 2028, ["龙岗区"]),
      L(3, 3, "C", "珠海规划", "规划", 80, 12, "x", "y", 160, 2030, ["金湾区"])
    ];
    setSnapshot(snap);

    const arr = summarizeMetroPlanningByStatus();
    const zaijian = arr.find((x) => x.status === "在建")!;
    expect(zaijian.lineCount).toBe(2);
    expect(zaijian.totalLengthKm).toBe(48);
    const guihua = arr.find((x) => x.status === "规划")!;
    expect(guihua.lineCount).toBe(1);
  });

  it("summarizeMetroPlanningByOpenYear 未来 5 年时间线（year 升序）", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 1, "A", "p", "在建", 30, 18, "x", "y", 80, 2028, ["天河区"]),
      L(2, 1, "B", "p", "即将开通", 10, 4, "x", "y", 80, 2026, ["番禺区"]),
      L(3, 2, "C", "p", "在建", 18, 18, "x", "y", 80, 2027, ["龙岗区"]),
      L(4, 3, "D", "p", "规划", 80, 12, "x", "y", 160, 2030, ["金湾区"])
    ];
    setSnapshot(snap);

    const arr = summarizeMetroPlanningByOpenYear();
    expect(arr).toHaveLength(4);
    expect(arr[0]!.year).toBe(2026);
    expect(arr[arr.length - 1]!.year).toBe(2030);
    expect(arr[1]!.year).toBe(2027);
    expect(arr[1]!.lineCount).toBe(1);
    // 2030 总里程最高（80km 珠肇高铁）
    const y2030 = arr.find((x) => x.year === 2030)!;
    expect(y2030.totalLengthKm).toBe(80);
  });

  it("summarizeMetroPlanningByPhase phase 维度（深圳五期 vs 广州四期）", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳线A", "深圳五期", "在建", 30, 18, "x", "y", 80, 2028, ["南山区"]),
      L(2, 2, "深圳线B", "深圳五期", "在建", 20, 18, "x", "y", 100, 2028, ["龙岗区"]),
      L(3, 1, "广州线A", "广州四期", "在建", 38, 19, "x", "y", 100, 2027, ["增城区"])
    ];
    setSnapshot(snap);

    const arr = summarizeMetroPlanningByPhase();
    const sz5 = arr.find((x) => x.phase === "深圳五期")!;
    expect(sz5.lineCount).toBe(2);
    expect(sz5.totalLengthKm).toBe(50);
    const gz4 = arr.find((x) => x.phase === "广州四期")!;
    expect(gz4.lineCount).toBe(1);
  });

  it("getMetroPlanningByOpenYear 某年全部线路 + 里程倒序", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 1, "A", "p", "即将开通", 5, 3, "x", "y", 80, 2026, ["x区"]),
      L(2, 1, "B", "p", "即将开通", 20, 11, "x", "y", 100, 2026, ["y区"]),
      L(3, 1, "C", "p", "在建", 30, 18, "x", "y", 80, 2028, ["z区"])
    ];
    setSnapshot(snap);

    const arr = getMetroPlanningByOpenYear(2026);
    expect(arr).toHaveLength(2);
    expect(arr[0]!.lineName).toBe("B"); // 20 km 最长
    expect(arr[1]!.lineName).toBe("A");
  });

  it("getMetroPlanningByStatus 某 status 全部（即将开通 → 落地）", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 1, "A", "p", "即将开通", 5, 3, "x", "y", 80, 2026, ["x区"]),
      L(2, 2, "B", "p", "即将开通", 20, 11, "x", "y", 100, 2026, ["y区"]),
      L(3, 1, "C", "p", "在建", 30, 18, "x", "y", 80, 2028, ["z区"])
    ];
    setSnapshot(snap);

    const arr = getMetroPlanningByStatus("即将开通");
    expect(arr).toHaveLength(2);
    expect(arr[0]!.lineName).toBe("B"); // 20km
  });

  it("getMetroPlanningByCityTopByLength + TopByStations", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳A", "p", "在建", 32.2, 24, "x", "y", 80, 2028, ["南山区"]),
      L(2, 2, "深圳B", "p", "在建", 18.6, 18, "x", "y", 80, 2028, ["龙岗区"]),
      L(3, 1, "广州A", "p", "在建", 38.4, 19, "x", "y", 100, 2027, ["增城区"])
    ];
    setSnapshot(snap);

    const topLen = getMetroPlanningByCityTopByLength(2, 2);
    expect(topLen).toHaveLength(2);
    expect(topLen[0]!.lineName).toBe("深圳A"); // 32.2 km

    const topSta = getMetroPlanningByCityTopByStations(2, 2);
    expect(topSta[0]!.lineName).toBe("深圳A"); // 24 站

    const allLen = getMetroPlanningByCityTopByLength(null, 3);
    expect(allLen[0]!.lineName).toBe("广州A"); // 38.4 全场最长
  });

  it("getMetroPlanningCrossCityByYear 跨城同年（2028 → 深圳 12 条）", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳线A", "p", "在建", 32.2, 24, "x", "y", 80, 2028, ["南山区"]),
      L(2, 2, "深圳线B", "p", "在建", 18.6, 18, "x", "y", 80, 2028, ["龙岗区"]),
      L(3, 1, "广州线A", "p", "在建", 31.7, 18, "x", "y", 100, 2028, ["花都区"]),
      L(4, 1, "广州线B", "p", "即将开通", 19.2, 11, "x", "y", 100, 2026, ["光明区"])
    ];
    setSnapshot(snap);

    const cross = getMetroPlanningCrossCityByYear(2028);
    expect(cross[2]).toEqual(["深圳线A", "深圳线B"]); // city 2 深圳
    expect(cross[1]).toEqual(["广州线A"]); // city 1 广州
    expect(cross[3]).toBeUndefined();
  });

  it("getMetroPlanningByCityFastLines ≥100km/h 跨城快线", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳18号线", "p", "在建", 19.4, 8, "x", "y", 120, 2028, ["盐田区"]),
      L(2, 2, "深圳20号线", "p", "在建", 34.0, 14, "x", "y", 120, 2028, ["宝安区"]),
      L(3, 1, "广州24号线", "p", "在建", 31.7, 18, "x", "y", 100, 2028, ["花都区"]),
      L(4, 1, "广州普通", "p", "在建", 10, 5, "x", "y", 80, 2027, ["x区"]),
      L(5, 3, "珠肇高铁", "p", "在建", 53, 5, "x", "y", 350, 2027, ["香洲区"])
    ];
    setSnapshot(snap);

    const fast = getMetroPlanningByCityFastLines(100);
    expect(fast).toHaveLength(4);
    expect(fast[0]!.lineName).toBe("珠肇高铁"); // 350km/h
    expect(fast[0]!.maxSpeedKmh).toBe(350);
  });

  it("getMetroPlanningByDistrict 某区覆盖线路（含 city 过滤）", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳A", "p", "在建", 32.2, 24, "x", "y", 80, 2028, ["南山区", "宝安区"]),
      L(2, 2, "深圳B", "p", "在建", 18.6, 18, "x", "y", 80, 2028, ["龙岗区"]),
      L(3, 1, "广州A", "p", "在建", 31.7, 18, "x", "y", 100, 2028, ["南山区"]) // 同名区
    ];
    setSnapshot(snap);

    // "南山区" 跨城有 2 条
    expect(getMetroPlanningByDistrict("南山区")).toHaveLength(2);
    // 限定 city 2 → 只剩深圳 A
    expect(getMetroPlanningByDistrict("南山区", 2)).toHaveLength(1);
    expect(getMetroPlanningByDistrict("南山区", 2)[0]!.lineName).toBe("深圳A");
    // "龙岗区" 只有 1 条
    expect(getMetroPlanningByDistrict("龙岗区")).toHaveLength(1);
  });

  it("getMetroPlanningByCityStatusVsStations city × status → 站数总和", () => {
    const snap = emptySnapshot();
    snap.metroLines = [
      L(1, 2, "深圳A", "p", "在建", 32.2, 24, "x", "y", 80, 2028, ["南山区"]),
      L(2, 2, "深圳B", "p", "在建", 18.6, 18, "x", "y", 80, 2028, ["龙岗区"]),
      L(3, 1, "广州A", "p", "在建", 38.4, 19, "x", "y", 100, 2027, ["增城区"]),
      L(4, 1, "广州B", "p", "即将开通", 19.2, 11, "x", "y", 100, 2026, ["光明区"])
    ];
    setSnapshot(snap);

    const arr = getMetroPlanningByCityStatusVsStations();
    // 深圳-在建 站数 42 最大
    expect(arr[0]!.cityId).toBe(2);
    expect(arr[0]!.status).toBe("在建");
    expect(arr[0]!.totalStations).toBe(42);
    expect(arr[0]!.lineCount).toBe(2);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.metroLines = [];
    setSnapshot(snap);

    expect(summarizeMetroPlanningByCity()).toEqual([]);
    expect(summarizeMetroPlanningByStatus()).toEqual([]);
    expect(summarizeMetroPlanningByOpenYear()).toEqual([]);
    expect(summarizeMetroPlanningByPhase()).toEqual([]);
    expect(getMetroPlanningByOpenYear(2028)).toEqual([]);
    expect(getMetroPlanningByStatus("在建")).toEqual([]);
    expect(getMetroPlanningByCityTopByLength(1, 5)).toEqual([]);
    expect(getMetroPlanningByCityTopByStations(1, 5)).toEqual([]);
    expect(getMetroPlanningCrossCityByYear(2028)).toEqual({});
    expect(getMetroPlanningByCityFastLines(100)).toEqual([]);
    expect(getMetroPlanningByDistrict("南山区")).toEqual([]);
    expect(getMetroPlanningByCityStatusVsStations()).toEqual([]);
  });
});