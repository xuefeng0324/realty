import { describe, expect, it } from "vitest";
import {
  getMetroPlanningGeoByCityCrossReference,
  getMetroPlanningGeoByCityMissingEndpoints,
  getMetroPlanningGeoByCityStartEnd,
  getMetroPlanningGeoByCityStraightLineTop,
  getMetroPlanningGeoByConfidence,
  getMetroPlanningGeoCoverageStats,
  getMetroPlanningGeoCrossCityByConfidence,
  getMetroPlanningGeoManualFallbackRate,
  haversineKm,
  straightLineMeters,
  summarizeMetroPlanningGeoByCity,
  summarizeMetroPlanningGeoByConfidence
} from "../src/local/metroPlanningGeoAnalysis";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalMetroLine,
  LocalMetroLineGeo
} from "../src/local/types";

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
    poiCommercials: [],
    adminDistricts: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function G(
  lineId: number,
  cityId: number,
  lineName: string,
  startLat: number | null,
  startLng: number | null,
  startConfidence: LocalMetroLineGeo["startConfidence"],
  endLat: number | null,
  endLng: number | null,
  endConfidence: LocalMetroLineGeo["endConfidence"]
): LocalMetroLineGeo {
  return {
    lineId,
    cityId,
    lineName,
    startStation: "S",
    endStation: "E",
    startLat,
    startLng,
    startConfidence,
    endLat,
    endLng,
    endConfidence
  };
}

function L(
  lineId: number,
  lengthKm: number | null
): LocalMetroLine {
  return {
    lineId,
    cityId: 0,
    lineName: "x",
    phase: "p",
    status: "在建",
    lengthKm,
    stationCount: null,
    startStation: "S",
    endStation: "E",
    maxSpeedKmh: null,
    openYearExpected: null,
    districts: [],
    notes: null
  };
}

describe("metroPlanningGeoAnalysis", () => {
  it("haversineKm 深圳 → 珠海直线 ~93 km", () => {
    // 深圳 22.54, 114.05 → 珠海 22.27, 113.57
    const d = haversineKm(22.54, 114.05, 22.27, 113.57);
    expect(d).toBeGreaterThan(55);
    expect(d).toBeLessThan(95);
  });

  it("straightLineMeters 端点齐全计算 + null 端点返回 null", () => {
    const g = G(1, 2, "X", 22.5, 114.0, "high", 22.6, 114.1, "high");
    const d = straightLineMeters(g);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(10000); // 10 km 量级

    const gMissing = G(2, 2, "Y", null, null, "missing", 22.6, 114.1, "high");
    expect(straightMeters(gMissing)).toBeNull();
  });

  it("summarizeMetroPlanningGeoByCity city 聚合 + 起终点 confidence 分布", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      // 深圳 3 条：起 high/终 high, 起 manual/终 medium, 起 manual/终 manual
      G(1, 2, "深圳A", 22.5, 114.0, "high", 22.6, 114.1, "high"),
      G(2, 2, "深圳B", 22.7, 114.2, "manual", 22.8, 114.3, "medium"),
      G(3, 2, "深圳C", 22.9, 114.4, "manual", 23.0, 114.5, "manual"),
      // 广州 2 条
      G(4, 1, "广州A", 23.1, 113.2, "high", 23.2, 113.3, "high"),
      G(5, 1, "广州B", 23.3, 113.4, "medium", null, null, "missing")
    ];
    setSnapshot(snap);

    const arr = summarizeMetroPlanningGeoByCity();
    expect(arr).toHaveLength(2);
    expect(arr[0]!.cityId).toBe(2); // 3 条 > 2 条
    expect(arr[0]!.lineCount).toBe(3);
    expect(arr[0]!.startConfidence.high).toBe(1);
    expect(arr[0]!.startConfidence.manual).toBe(2);
    expect(arr[0]!.endConfidence.high).toBe(1);
    expect(arr[0]!.endConfidence.manual).toBe(1);

    // 广州只有 1 条端点齐全 → avgStraightLineKm 唯一值
    const gz = arr.find((x) => x.cityId === 1)!;
    expect(gz.lineCount).toBe(2);
    expect(gz.avgStraightLineKm).toBeGreaterThan(0);
    expect(gz.endConfidence.missing).toBe(1);
  });

  it("summarizeMetroPlanningGeoByConfidence 5 类 confidence 维度", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 2, "A", 22.5, 114.0, "high", 22.6, 114.1, "high"),
      G(2, 2, "B", 22.7, 114.2, "manual", 22.8, 114.3, "high"),
      G(3, 1, "C", 23.1, 113.2, "high", 23.2, 113.3, "high")
    ];
    setSnapshot(snap);

    const arr = summarizeMetroPlanningGeoByConfidence();
    const high = arr.find((x) => x.level === "high")!;
    expect(high.count).toBe(3); // 3 条都有 high（line1/line3 双端 / line2 终点）
    expect(high.cityCount).toBe(2);
    expect(high.topLineNames).toHaveLength(3);

    const manual = arr.find((x) => x.level === "manual")!;
    expect(manual.count).toBe(1);
  });

  it("getMetroPlanningGeoByConfidence 某 confidence 全部", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 2, "A", 22.5, 114.0, "high", 22.6, 114.1, "high"),
      G(2, 2, "B", 22.7, 114.2, "manual", 22.8, 114.3, "high"),
      G(3, 2, "C", 22.9, 114.4, "manual", 23.0, 114.5, "manual")
    ];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoByConfidence("manual");
    expect(arr).toHaveLength(2); // line2 + line3
  });

  it("getMetroPlanningGeoByCityStraightLineTop 直距 Top N", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      // 深圳 3 条：远近不同
      G(1, 2, "近", 22.5, 114.0, "high", 22.51, 114.01, "high"), // ~1.4km
      G(2, 2, "中", 22.5, 114.0, "high", 22.7, 114.3, "high"), // ~38km
      G(3, 2, "远", 22.5, 114.0, "high", 23.0, 114.5, "high"), // ~75km
      G(4, 2, "缺", 22.5, 114.0, "high", null, null, "missing") // 缺
    ];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoByCityStraightLineTop(2, 3);
    expect(arr).toHaveLength(3); // 跳过"缺"
    expect(arr[0]!.lineName).toBe("远");
    expect(arr[2]!.lineName).toBe("近");
  });

  it("getMetroPlanningGeoByCityStartEnd 端点坐标 + 直距", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [G(1, 1, "广州A", 23.1, 113.2, "high", 23.2, 113.3, "high")];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoByCityStartEnd(1);
    expect(arr).toHaveLength(1);
    expect(arr[0]!.startLat).toBe(23.1);
    expect(arr[0]!.straightLineM).toBeGreaterThan(10000);
  });

  it("getMetroPlanningGeoCrossCityByConfidence 跨城同 confidence 对比", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 1, "广州A", 23.1, 113.2, "high", 23.2, 113.3, "high"),
      G(2, 2, "深圳A", 22.5, 114.0, "high", 22.6, 114.1, "high"),
      G(3, 2, "深圳B", 22.7, 114.2, "high", 22.8, 114.3, "high")
    ];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoCrossCityByConfidence("high");
    expect(arr).toHaveLength(2);
    expect(arr[0]!.cityId).toBe(2); // 深圳 2 条 > 广州 1 条
    expect(arr[0]!.lineCount).toBe(2);
  });

  it("getMetroPlanningGeoManualFallbackRate manual 占比", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 1, "A", 23.1, 113.2, "high", 23.2, 113.3, "high"), // 全 high
      G(2, 1, "B", 23.3, 113.4, "manual", 23.4, 113.5, "medium"), // 1 个 manual
      G(3, 2, "C", 22.5, 114.0, "manual", 22.6, 114.1, "manual") // 2 个 manual
    ];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoManualFallbackRate();
    const sz = arr.find((x) => x.cityId === 2)!;
    expect(sz.manualRatio).toBe(1); // 1/1 = 1
    const gz = arr.find((x) => x.cityId === 1)!;
    expect(gz.totalLines).toBe(2);
    expect(gz.manualLines).toBe(1);
    expect(gz.manualRatio).toBe(0.5);
  });

  it("getMetroPlanningGeoByCityCrossReference 直线 vs 实际 + 弯曲系数", () => {
    const snap = emptySnapshot();
    // 深圳一条：直线 10km，实际 12km → 弯曲 1.2
    snap.metroLineGeos = [
      G(1, 2, "深圳A", 22.5, 114.0, "high", 22.59, 114.0, "high")
    ];
    snap.metroLines = [L(1, 12)];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoByCityCrossReference();
    expect(arr).toHaveLength(1);
    expect(arr[0]!.straightLineKm).toBeGreaterThan(8);
    expect(arr[0]!.actualLengthKm).toBe(12);
    expect(arr[0]!.curvatureRatio).toBeGreaterThan(1.1);
    expect(arr[0]!.curvatureRatio!).toBeLessThan(1.5);
  });

  it("getMetroPlanningGeoByCityMissingEndpoints 缺坐标过滤", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 1, "A", 23.1, 113.2, "high", 23.2, 113.3, "high"), // 完整
      G(2, 1, "B", null, null, "missing", 23.4, 113.5, "high"), // 起缺失
      G(3, 2, "C", 22.5, 114.0, "high", null, null, "missing") // 终缺失
    ];
    setSnapshot(snap);
    const arr = getMetroPlanningGeoByCityMissingEndpoints();
    expect(arr).toHaveLength(2);
    expect(arr.find((x) => x.lineId === 1)).toBeUndefined();

    const gzOnly = getMetroPlanningGeoByCityMissingEndpoints(1);
    expect(gzOnly).toHaveLength(1);
    expect(gzOnly[0]!.lineName).toBe("B");
  });

  it("getMetroPlanningGeoCoverageStats 覆盖率", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [
      G(1, 1, "A", 23.1, 113.2, "high", 23.2, 113.3, "high"), // 2/2 完整
      G(2, 1, "B", 23.3, 113.4, "medium", null, null, "missing") // 1/2 完整
    ];
    setSnapshot(snap);
    const stats = getMetroPlanningGeoCoverageStats();
    expect(stats.totalEndpoints).toBe(4);
    expect(stats.completeEndpoints).toBe(3);
    expect(stats.coverageRatio).toBe(0.75);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.metroLineGeos = [];
    snap.metroLines = [];
    setSnapshot(snap);

    expect(summarizeMetroPlanningGeoByCity()).toEqual([]);
    expect(summarizeMetroPlanningGeoByConfidence()).toEqual([]);
    expect(getMetroPlanningGeoByConfidence("high")).toEqual([]);
    expect(getMetroPlanningGeoByCityStraightLineTop(1, 5)).toEqual([]);
    expect(getMetroPlanningGeoByCityStartEnd(1)).toEqual([]);
    expect(getMetroPlanningGeoCrossCityByConfidence("high")).toEqual([]);
    expect(getMetroPlanningGeoManualFallbackRate()).toEqual([]);
    expect(getMetroPlanningGeoByCityCrossReference()).toEqual([]);
    expect(getMetroPlanningGeoByCityMissingEndpoints(1)).toEqual([]);
    expect(getMetroPlanningGeoCoverageStats()).toEqual({
      totalEndpoints: 0,
      completeEndpoints: 0,
      coverageRatio: 0
    });
  });
});

// 修正函数名 typo（测试 helper）
function straightMeters(g: LocalMetroLineGeo): number | null {
  return straightLineMeters(g);
}