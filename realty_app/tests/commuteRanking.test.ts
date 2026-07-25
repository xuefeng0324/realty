import { describe, expect, it } from "vitest";
import {
  getCommuteByCityFastestSlowestCompare,
  getCommuteFastestTopN,
  getCommuteSpeedLeaderboard,
  summarizeCommuteByCity
} from "../src/local/commuteRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalCommute } from "../src/local/types";

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

function C(
  communityId: number,
  cityId: number,
  cityName: string,
  transitMinutes: number | null,
  transitDistanceM: number | null
): LocalCommute {
  return {
    communityId,
    cityId,
    cityName,
    cbdName: "深圳福田CBD",
    cbdLat: 22.542185,
    cbdLng: 114.050828,
    transitMinutes,
    transitDistanceM
  };
}

describe("commuteRanking", () => {
  it("summarizeCommuteByCity 聚合 + 速度 = km/h", () => {
    const snap = emptySnapshot();
    snap.commutes = [
      C(1, 2, "深圳", 30, 6000), // 12 km/h
      C(2, 2, "深圳", 60, 12000), // 12 km/h
      C(3, 1, "广州", 45, 9000), // 12 km/h
      C(4, 2, "深圳", null, 12000) // null 跳过
    ];
    setSnapshot(snap);

    const sum = summarizeCommuteByCity();
    expect(sum).toHaveLength(2);

    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.communityCount).toBe(3);
    expect(sz.avgMinutes).toBeCloseTo(45, 5); // (30+60)/2 跳过 null
    // 深圳 3 行距离：6000 + 12000 + 12000(null min) → null min 那行也被过滤（因 transitMinutes=null）
    // 实现：safeAvg([6000, 12000, 12000]) 包含 null min 的行（它的 dist 不为 null），所以 3 行平均
    // = 10000
    expect(sz.avgDistanceM).toBeCloseTo(10000, 5);
    // 速度 = avgDist(km) / avgMin(h) = 10 / 0.75 ≈ 13.33
    expect(sz.avgSpeedKmh).toBeCloseTo(13.33, 1);
    expect(sz.fastest?.communityId).toBe(1);
    expect(sz.slowest?.communityId).toBe(2);
  });

  it("getCommuteFastestTopN null 末尾 + city 过滤", () => {
    const snap = emptySnapshot();
    snap.commutes = [
      C(1, 2, "深圳", 30, 6000),
      C(2, 2, "深圳", null, 12000),
      C(3, 1, "广州", 20, 4000), // 跨城最快
      C(4, 1, "广州", 50, 10000)
    ];
    setSnapshot(snap);

    const all = getCommuteFastestTopN(null, 5);
    expect(all).toHaveLength(4);
    expect(all[0]!.communityId).toBe(3); // 20 min
    expect(all[1]!.communityId).toBe(1); // 30 min
    expect(all[2]!.communityId).toBe(4); // 50 min
    expect(all[3]!.communityId).toBe(2); // null 末尾

    const city2 = getCommuteFastestTopN(2, 5);
    expect(city2).toHaveLength(2);
    expect(city2.every((c) => c.cityId === 2)).toBe(true);
  });

  it("getCommuteSpeedLeaderboard 速度最快 Top N + 跳过 null/0", () => {
    const snap = emptySnapshot();
    snap.commutes = [
      C(1, 2, "深圳", 30, 12000), // 24 km/h
      C(2, 2, "深圳", 60, 12000), // 12 km/h
      C(3, 2, "深圳", 30, 6000),  // 12 km/h
      C(4, 2, "深圳", null, 6000), // null 跳过
      C(5, 2, "深圳", 0, 6000)    // 0 跳过（避免除 0）
    ];
    setSnapshot(snap);

    const lb = getCommuteSpeedLeaderboard(2, 3);
    expect(lb).toHaveLength(3);
    expect(lb[0]!.communityId).toBe(1); // 24 km/h 最快
    expect(lb[1]!.communityId).toBe(2); // 12 km/h
    expect(lb[2]!.communityId).toBe(3); // 12 km/h
    expect(lb[0]!.speedKmh).toBeCloseTo(24, 5);
  });

  it("getCommuteByCityFastestSlowestCompare 最快/最慢 倍数", () => {
    const snap = emptySnapshot();
    snap.commutes = [
      C(1, 2, "深圳", 30, 6000),  // 最快
      C(2, 2, "深圳", 60, 12000), // 中
      C(3, 2, "深圳", 90, 18000), // 最慢
      C(4, 1, "广州", 20, 4000),
      C(5, 1, "广州", 40, 8000)
    ];
    setSnapshot(snap);

    const cmp = getCommuteByCityFastestSlowestCompare();
    expect(cmp).toHaveLength(2);
    const sz = cmp.find((c) => c.cityId === 2)!;
    expect(sz.fastestMinutes).toBe(30);
    expect(sz.slowestMinutes).toBe(90);
    expect(sz.ratio).toBeCloseTo(3, 5); // 90/30 = 3

    const gz = cmp.find((c) => c.cityId === 1)!;
    expect(gz.ratio).toBeCloseTo(2, 5); // 40/20 = 2
  });

  it("空 snapshot / 单条 commute 安全降级", () => {
    const snap = emptySnapshot();
    snap.commutes = [];
    setSnapshot(snap);

    expect(summarizeCommuteByCity()).toEqual([]);
    expect(getCommuteFastestTopN(null, 5)).toEqual([]);
    expect(getCommuteSpeedLeaderboard(2, 5)).toEqual([]);
    expect(getCommuteByCityFastestSlowestCompare()).toEqual([]);

    // 仅 1 条（fastest/slowest 不应触发 ratio 计算）
    snap.commutes = [C(1, 2, "深圳", 30, 6000)];
    setSnapshot(snap);

    const cmp = getCommuteByCityFastestSlowestCompare();
    expect(cmp).toEqual([]); // < 2 valid → 不算 ratio
  });
});