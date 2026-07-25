import { describe, expect, it } from "vitest";
import {
  detectHospitalGeoDuplicateAmapPoi,
  getHospitalGeoByCityAddressDistrict,
  getHospitalGeoByCityByConfidence,
  getHospitalGeoByCityHighConfidenceRatio,
  getHospitalGeoByCityNearestPair,
  getHospitalGeoByCityWithinRadius,
  getHospitalGeoCoverageStats,
  getHospitalGeoCrossCityByCityPairDistance,
  summarizeHospitalGeoByCity,
  summarizeHospitalGeoByConfidence
} from "../src/local/hospitalGeoAnalysis";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalHospital,
  LocalHospitalGeo
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

function H(
  hospitalId: number,
  cityId: number,
  officialName: string
): LocalHospital {
  return {
    hospitalId,
    cityId,
    officialName,
    displayName: null,
    hospitalType: null,
    hospitalLevel: "三甲",
    districtName: null,
    address: null,
    lat: null,
    lng: null
  };
}

function G(
  hospitalId: number,
  lat: number | null,
  lng: number | null,
  amapPoiId: string,
  formattedAddress: string,
  confidence: LocalHospitalGeo["confidence"],
  distanceM: number | null = 100
): LocalHospitalGeo {
  return {
    hospitalId,
    lat,
    lng,
    amapPoiId,
    formattedAddress,
    confidence,
    source: "amap_text",
    distanceM
  };
}

describe("hospitalGeoAnalysis", () => {
  it("summarizeHospitalGeoByCity city 聚合 + 重复 amapPoiId", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "深圳A"), H(2, 2, "深圳B"), H(3, 1, "广州A")];
    snap.hospitalGeos = [
      // 深圳 2 条：1 unique + 1 重复（B02F3006F6 重复）
      G(1, 22.5, 114.0, "B02F3006F6", "广东省深圳市福田区莲花街道深圳市儿童医院", "medium"),
      G(2, 22.6, 114.1, "B02F3006F6", "广东省深圳市福田区莲花街道深圳市儿童医院(副本)", "low"),
      // 广州 1 条
      G(3, 23.1, 113.2, "B00140226E", "广东省广州市越秀区农林街道中山大学附属第一医院", "high", 200)
    ];
    setSnapshot(snap);

    const arr = summarizeHospitalGeoByCity();
    expect(arr).toHaveLength(2);
    expect(arr[0]!.cityId).toBe(2); // 深圳 2 条 > 广州 1 条
    expect(arr[0]!.geoCount).toBe(2);
    expect(arr[0]!.uniquePoiCount).toBe(1); // 重复 → 去重
    expect(arr[0]!.duplicatePoiCount).toBe(1);
    expect(arr[0]!.confidence.medium).toBe(1);
    expect(arr[0]!.confidence.low).toBe(1);

    const gz = arr.find((s) => s.cityId === 1)!;
    expect(gz.duplicatePoiCount).toBe(0);
    expect(gz.confidence.high).toBe(1);
    expect(gz.avgDistanceM).toBe(200);
  });

  it("summarizeHospitalGeoByConfidence 4 等级维度", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 1, "B"), H(3, 2, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳医院1", "high"),
      G(2, 23.1, 113.2, "P2", "广州医院1", "medium"),
      G(3, 22.6, 114.1, "P3", "深圳医院2", "low")
    ];
    setSnapshot(snap);

    const arr = summarizeHospitalGeoByConfidence();
    expect(arr).toHaveLength(3);
    // 3 个等级各 1 条，排序后顺序不稳定 → 用 set 验证
    const levels = arr.map((x) => x.level).sort();
    expect(levels).toEqual(["high", "low", "medium"]);
    expect(arr.every((x) => x.count === 1)).toBe(true);
  });

  it("getHospitalGeoByCityByConfidence 某 city 某 confidence", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳医院1", "high"),
      G(2, 22.6, 114.1, "P2", "深圳医院2", "medium")
    ];
    setSnapshot(snap);
    const high = getHospitalGeoByCityByConfidence(2, "high");
    expect(high).toHaveLength(1);
    expect(high[0]!.hospitalId).toBe(1);

    const gz = getHospitalGeoByCityByConfidence(1, "high");
    expect(gz).toHaveLength(0);
  });

  it("getHospitalGeoByCityNearestPair 市内最近两医院", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B"), H(3, 2, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳A", "high"), // 参考点
      G(2, 22.51, 114.01, "P2", "深圳B", "high"), // 距 A ~1.6km
      G(3, 23.0, 114.5, "P3", "深圳C", "high") // 距 A 远
    ];
    setSnapshot(snap);
    const pairs = getHospitalGeoByCityNearestPair(2, 5);
    expect(pairs).toHaveLength(3); // C(3,2) = 3 pairs
    expect(pairs[0]!.hospitalIdA).toBe(1);
    expect(pairs[0]!.hospitalIdB).toBe(2);
    expect(pairs[0]!.distanceKm).toBeLessThan(5);
  });

  it("getHospitalGeoCrossCityByCityPairDistance 跨城最近对", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "深圳A"), H(2, 1, "广州A")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳A", "high"),
      G(2, 23.1, 113.2, "P2", "广州A", "high")
    ];
    setSnapshot(snap);
    const cross = getHospitalGeoCrossCityByCityPairDistance(5);
    expect(cross).toHaveLength(1);
    expect(cross[0]!.cityIdA).toBe(1); // 广州小
    expect(cross[0]!.cityIdB).toBe(2);
    expect(cross[0]!.distanceKm).toBeGreaterThan(50);
  });

  it("getHospitalGeoByCityWithinRadius 急救半径覆盖", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B"), H(3, 2, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳A", "high"), // 距 ref 0 km
      G(2, 22.51, 114.01, "P2", "深圳B", "high"), // 距 ref ~1.6km
      G(3, 23.0, 114.5, "P3", "深圳C", "high") // 距 ref 远
    ];
    setSnapshot(snap);
    const result = getHospitalGeoByCityWithinRadius(2, 22.5, 114.0, 5);
    expect(result.withinCount).toBe(2); // A + B
    expect(result.hospitalIds).toEqual([1, 2]);

    const result10 = getHospitalGeoByCityWithinRadius(2, 22.5, 114.0, 100);
    expect(result10.withinCount).toBe(3); // A+B+C 全覆盖（最远 ~78km）
  });

  it("detectHospitalGeoDuplicateAmapPoi 重复 amapPoiId 检测", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B"), H(3, 1, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "B02F3006F6", "深圳儿童医院", "medium"),
      G(2, 22.6, 114.1, "B02F3006F6", "深圳儿童医院副本", "low"), // 重复
      G(3, 23.1, 113.2, "B00140226E", "广州中山一院", "high")
    ];
    setSnapshot(snap);

    const dup = detectHospitalGeoDuplicateAmapPoi();
    expect(dup).toHaveLength(1);
    expect(dup[0]!.amapPoiId).toBe("B02F3006F6");
    expect(dup[0]!.hospitalIds).toEqual([1, 2]);
    expect(dup[0]!.count).toBe(2);
  });

  it("getHospitalGeoByCityAddressDistrict 按 formatted_address 区划聚合", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B"), H(3, 2, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "广东省深圳市福田区莲花街道医院1", "high"),
      G(2, 22.6, 114.1, "P2", "广东省深圳市福田区沙头街道医院2", "high"),
      G(3, 22.7, 114.2, "P3", "广东省深圳市罗湖区南湖街道医院3", "medium")
    ];
    setSnapshot(snap);
    const arr = getHospitalGeoByCityAddressDistrict(2);
    expect(arr[0]!.districtName).toBe("福田区");
    expect(arr[0]!.count).toBe(2);
    expect(arr[1]!.districtName).toBe("罗湖区");
    expect(arr[1]!.count).toBe(1);
  });

  it("getHospitalGeoByCityHighConfidenceRatio 高 confidence 占比", () => {
    const snap = emptySnapshot();
    snap.hospitals = [H(1, 2, "A"), H(2, 2, "B"), H(3, 1, "C")];
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "深圳A", "high"),
      G(2, 22.6, 114.1, "P2", "深圳B", "medium"),
      G(3, 23.1, 113.2, "P3", "广州C", "high")
    ];
    setSnapshot(snap);
    const arr = getHospitalGeoByCityHighConfidenceRatio();
    const sz = arr.find((x) => x.cityId === 2)!;
    expect(sz.total).toBe(2);
    expect(sz.highConfidence).toBe(1);
    expect(sz.ratio).toBe(0.5);
    const gz = arr.find((x) => x.cityId === 1)!;
    expect(gz.ratio).toBe(1);
  });

  it("getHospitalGeoCoverageStats 全国覆盖率", () => {
    const snap = emptySnapshot();
    snap.hospitalGeos = [
      G(1, 22.5, 114.0, "P1", "医院1", "high"),
      G(2, null, null, "P2", "医院2（缺坐标）", "missing", null),
      G(3, 23.1, 113.2, "P3", "医院3", "medium")
    ];
    setSnapshot(snap);
    const stats = getHospitalGeoCoverageStats();
    expect(stats.total).toBe(3);
    expect(stats.withCoords).toBe(2);
    expect(stats.coverageRatio).toBeCloseTo(0.667, 2);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.hospitalGeos = [];
    snap.hospitals = [];
    setSnapshot(snap);

    expect(summarizeHospitalGeoByCity()).toEqual([]);
    expect(summarizeHospitalGeoByConfidence()).toEqual([]);
    expect(getHospitalGeoByCityByConfidence(1, "high")).toEqual([]);
    expect(getHospitalGeoByCityNearestPair(1, 5)).toEqual([]);
    expect(getHospitalGeoCrossCityByCityPairDistance(5)).toEqual([]);
    const radius = getHospitalGeoByCityWithinRadius(1, 22.5, 114.0, 5);
    expect(radius.withinCount).toBe(0);
    expect(radius.hospitalIds).toEqual([]);
    expect(detectHospitalGeoDuplicateAmapPoi()).toEqual([]);
    expect(getHospitalGeoByCityAddressDistrict(1)).toEqual([]);
    expect(getHospitalGeoByCityHighConfidenceRatio()).toEqual([]);
    expect(getHospitalGeoCoverageStats()).toEqual({
      total: 0,
      withCoords: 0,
      coverageRatio: 0
    });
  });
});