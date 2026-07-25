import { describe, expect, it } from "vitest";
import {
  getCommunityCommercialByCityDistrict,
  getCommunityCommercialByNearest,
  getCommunityCommercialByScoreTopN,
  getCommunityCommercialDensityVsDistance,
  summarizeCommunityCommercialByCity
} from "../src/local/communityCommercialRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalCommunityCommercial
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
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function CC(
  communityId: number,
  cityId: number,
  districtName: string,
  communityName: string,
  restaurantCount: number,
  bankCount: number,
  convenienceCount: number,
  nearestRestaurantM: number | null,
  nearestBankM: number | null,
  nearestConvenienceM: number | null,
  commercialScore: number
): LocalCommunityCommercial {
  return {
    communityId,
    cityId,
    districtName,
    communityName,
    restaurantCount,
    bankCount,
    convenienceCount,
    nearestRestaurantM,
    nearestBankM,
    nearestConvenienceM,
    commercialScore
  };
}

describe("communityCommercialRanking", () => {
  it("summarizeCommunityCommercialByCity 聚合 + null 安全", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [
      CC(1, 2, "南山区", "A", 3, 3, 3, 165, 52, 72, 100),
      CC(2, 2, "南山区", "B", 3, 3, 3, 172, 151, 146, 95),
      CC(3, 2, "福田区", "C", 3, 3, 3, 261, 224, 106, 90),
      CC(4, 1, "越秀区", "D", 2, 2, 2, null, 97, 44, 80),
      CC(5, 1, "海珠区", "E", 1, 1, 1, 35, 88, 102, 60)
    ];
    setSnapshot(snap);

    const sum = summarizeCommunityCommercialByCity();
    expect(sum).toHaveLength(2);
    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.communityCount).toBe(3);
    expect(sz.avgCommercialScore).toBeCloseTo(95, 5);
    expect(sz.avgRestaurantCount).toBeCloseTo(3, 5);
    // nearestRestaurantM null 安全
    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.communityCount).toBe(2);
    expect(gz.avgCommercialScore).toBeCloseTo(70, 5);
    // 越秀 null + 海珠 35 = 35 / 1 = 35
    expect(gz.avgNearestRestaurantM).toBeCloseTo(35, 5);
    // bank 都有 (97, 88) → 92.5
    expect(gz.avgNearestBankM).toBeCloseTo(92.5, 5);
  });

  it("getCommunityCommercialByScoreTopN 全市 / city 过滤", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [
      CC(1, 2, "南山区", "A", 3, 3, 3, 165, 52, 72, 100),
      CC(2, 2, "南山区", "B", 3, 3, 3, 172, 151, 146, 90),
      CC(3, 1, "越秀区", "C", 2, 2, 2, 100, 100, 100, 80)
    ];
    setSnapshot(snap);

    const all = getCommunityCommercialByScoreTopN(null, 2);
    expect(all).toHaveLength(2);
    expect(all[0]!.communityId).toBe(1);
    expect(all[1]!.communityId).toBe(2);

    const city2 = getCommunityCommercialByScoreTopN(2, 5);
    expect(city2).toHaveLength(2);
    expect(city2.every((c) => c.cityId === 2)).toBe(true);
  });

  it("getCommunityCommercialByNearest 单 POI 类型最近", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [
      CC(1, 2, "南山区", "A", 3, 3, 3, 50, 200, 300, 90),
      CC(2, 2, "南山区", "B", 3, 3, 3, 100, 100, 200, 85),
      CC(3, 2, "福田区", "C", 3, 3, 3, 200, 50, 100, 80),
      CC(4, 2, "福田区", "D", 3, 3, 3, null, 200, 250, 75) // null
    ];
    setSnapshot(snap);

    const nearestRest = getCommunityCommercialByNearest("restaurant", null, 5);
    expect(nearestRest[0]!.communityId).toBe(1); // 50m
    expect(nearestRest[1]!.communityId).toBe(2); // 100m
    // null 不应该出现
    expect(nearestRest.every((c) => c.nearestRestaurantM != null)).toBe(true);

    const nearestBank = getCommunityCommercialByNearest("bank", null, 5);
    expect(nearestBank[0]!.communityId).toBe(3); // 50m

    const nearestConv = getCommunityCommercialByNearest("convenience", null, 5);
    expect(nearestConv[0]!.communityId).toBe(3); // 100m
  });

  it("getCommunityCommercialByCityDistrict 区分聚合 + rankOverall", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [
      CC(1, 2, "南山区", "A", 3, 3, 3, 165, 52, 72, 100),
      CC(2, 2, "南山区", "B", 3, 3, 3, 172, 151, 146, 95),
      CC(3, 2, "福田区", "C", 3, 3, 3, 261, 224, 106, 80),
      CC(4, 1, "越秀区", "D", 3, 3, 3, 100, 100, 100, 70)
    ];
    setSnapshot(snap);

    const city2 = getCommunityCommercialByCityDistrict(2);
    expect(city2).toHaveLength(2);
    expect(city2[0]!.districtName).toBe("南山区"); // avg 97.5
    expect(city2[0]!.communityCount).toBe(2);
    expect(city2[0]!.rankOverall).toBe(1);
    expect(city2[1]!.districtName).toBe("福田区");
    expect(city2[1]!.rankOverall).toBe(2);

    const all = getCommunityCommercialByCityDistrict();
    expect(all).toHaveLength(3);
    expect(all[0]!.rankOverall).toBe(1);
  });

  it("getCommunityCommercialDensityVsDistance 4 桶分布", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [
      // 高密度近
      CC(1, 2, "南山区", "A", 3, 3, 3, 100, 0, 0, 90),
      CC(2, 2, "南山区", "B", 4, 0, 0, 150, 0, 0, 85),
      // 高密度远
      CC(3, 2, "福田区", "C", 3, 0, 0, 500, 0, 0, 80),
      // 低密度近
      CC(4, 2, "福田区", "D", 1, 0, 0, 100, 0, 0, 70),
      // 低密度远
      CC(5, 1, "越秀区", "E", 1, 0, 0, 800, 0, 0, 60)
    ];
    setSnapshot(snap);

    const buckets = getCommunityCommercialDensityVsDistance(
      "restaurant",
      2.5,
      200
    );
    expect(buckets).toHaveLength(4);
    expect(buckets[0]!.bucket).toBe("高密度近");
    expect(buckets[0]!.count).toBe(2);
    expect(buckets[0]!.communities.map((c) => c.communityId)).toEqual([1, 2]);

    expect(buckets[1]!.bucket).toBe("高密度远");
    expect(buckets[1]!.count).toBe(1);
    expect(buckets[1]!.communities[0]!.communityId).toBe(3);

    expect(buckets[2]!.bucket).toBe("低密度近");
    expect(buckets[2]!.count).toBe(1);

    expect(buckets[3]!.bucket).toBe("低密度远");
    expect(buckets[3]!.count).toBe(1);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.communityCommercials = [];
    setSnapshot(snap);

    expect(summarizeCommunityCommercialByCity()).toEqual([]);
    expect(getCommunityCommercialByScoreTopN(null, 5)).toEqual([]);
    expect(getCommunityCommercialByNearest("restaurant", null, 5)).toEqual([]);
    expect(getCommunityCommercialByCityDistrict()).toEqual([]);
    expect(getCommunityCommercialDensityVsDistance("restaurant", 2.5, 200)).toHaveLength(4);
    expect(getCommunityCommercialDensityVsDistance("restaurant", 2.5, 200)[0]!.count).toBe(0);
  });
});