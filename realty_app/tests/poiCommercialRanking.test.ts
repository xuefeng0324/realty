import { describe, expect, it } from "vitest";
import {
  getPoiCommercialByCityBankCoverage,
  getPoiCommercialByCityBankNearestByCommunity,
  getPoiCommercialByCityConvenienceLeaderboard,
  getPoiCommercialByCityRestaurantNearestByCommunity,
  getPoiCommercialByCommunityNearestAcross,
  getPoiCommercialByCommunityTopByCategory,
  getPoiCommercialByCommunityWalkScore,
  getPoiCommercialByPoiTypeLeaderboard,
  getPoiCommercialCrossCommunityByCategoryDistance,
  summarizePoiCommercialByCategory,
  summarizePoiCommercialByCity
} from "../src/local/poiCommercialRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalCommunity, LocalPoiCommercial } from "../src/local/types";

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
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function community(communityId: number, cityId: number, name = `c${communityId}`): LocalCommunity {
  return {
    communityId,
    cityId,
    districtName: "测试区",
    communityName: name
  };
}

/** 按测试约定：community 1/2/11 → 广州(1)，30/40 → 深圳(2) */
function withTestCommunities(snap: DataSnapshot, extra: LocalCommunity[] = []): void {
  const base = [
    community(1, 1, "广州测小区1"),
    community(2, 1, "广州测小区2"),
    community(11, 1, "广州测小区11"),
    community(30, 2, "深圳测小区30"),
    community(40, 2, "深圳测小区40")
  ];
  const byId = new Map<number, LocalCommunity>();
  for (const c of [...base, ...extra]) byId.set(c.communityId, c);
  snap.communities = [...byId.values()];
}

function PC(
  communityId: number,
  poiCategory: LocalPoiCommercial["poiCategory"],
  rank: number,
  poiName: string,
  poiType: string,
  distanceM: number,
  address: string = "test-address"
): LocalPoiCommercial {
  return {
    communityId,
    poiCategory,
    rank,
    poiName,
    poiType,
    distanceM,
    lat: null,
    lng: null,
    address
  };
}

describe("poiCommercialRanking", () => {
  it("summarizePoiCommercialByCity city 聚合 + category 分布 + 平均距离", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      // community 1（广州 cityOf=1）：餐厅/银行/便利店 各 3 个
      PC(1, "restaurant", 1, "R1", "餐饮", 100),
      PC(1, "restaurant", 2, "R2", "餐饮", 200),
      PC(1, "restaurant", 3, "R3", "餐饮", 300),
      PC(1, "bank", 1, "B1", "银行", 50),
      PC(1, "bank", 2, "B2", "银行", 80),
      PC(1, "bank", 3, "B3", "银行", 100),
      PC(1, "convenience", 1, "C1", "便利店", 70),
      PC(1, "convenience", 2, "C2", "便利店", 110),
      PC(1, "convenience", 3, "C3", "便利店", 120),
      // community 30（深圳 cityOf=2）：3 个
      PC(30, "restaurant", 1, "R4", "餐饮", 150),
      PC(30, "bank", 1, "B4", "银行", 90),
      PC(30, "convenience", 1, "C4", "便利店", 60)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const arr = summarizePoiCommercialByCity();
    expect(arr).toHaveLength(2);
    // 广州 9 条 > 深圳 3 条
    expect(arr[0]!.cityId).toBe(1);
    expect(arr[0]!.totalPois).toBe(9);
    expect(arr[0]!.communityCount).toBe(1);
    expect(arr[0]!.categoryDistribution.restaurant).toBe(3);
    expect(arr[0]!.categoryDistribution.bank).toBe(3);
    expect(arr[0]!.categoryDistribution.convenience).toBe(3);
    // 平均距离 (100+200+300+50+80+100+70+110+120)/9 = 1130/9 ≈ 125.56
    expect(arr[0]!.avgTopDistanceM).toBeCloseTo(125.56, 1);
    const sz = arr.find((s) => s.cityId === 2)!;
    expect(sz.totalPois).toBe(3);
  });

  it("summarizePoiCommercialByCategory category 维度统计", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "restaurant", 1, "R1", "餐饮", 100),
      PC(1, "restaurant", 2, "R2", "餐饮", 200),
      PC(30, "restaurant", 1, "R3", "餐饮", 150),
      PC(1, "bank", 1, "B1", "银行", 50),
      PC(30, "bank", 1, "B2", "银行", 90),
      PC(1, "convenience", 1, "C1", "便利店", 70)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const arr = summarizePoiCommercialByCategory();
    expect(arr).toHaveLength(3);
    const restaurant = arr.find((s) => s.category === "restaurant")!;
    expect(restaurant.poiCount).toBe(3);
    expect(restaurant.communityCount).toBe(2);
    expect(restaurant.minTopDistanceM).toBe(100);
    expect(restaurant.maxTopDistanceM).toBe(200);
    expect(restaurant.avgTopDistanceM).toBeCloseTo(150, 1);

    const bank = arr.find((s) => s.category === "bank")!;
    expect(bank.communityCount).toBe(2);
    expect(bank.avgTopDistanceM).toBe(70); // (50+90)/2

    const conv = arr.find((s) => s.category === "convenience")!;
    expect(conv.poiCount).toBe(1);
  });

  it("getPoiCommercialByCommunityTopByCategory 3 类最近各 1", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "restaurant", 1, "R1", "餐饮", 200),
      PC(1, "restaurant", 2, "R2", "餐饮", 100), // 最近
      PC(1, "bank", 1, "B1", "银行", 80),
      PC(1, "convenience", 1, "C1", "便利店", 70)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const tops = getPoiCommercialByCommunityTopByCategory(1);
    expect(tops).toHaveLength(3);
    expect(tops.find((t) => t.poiCategory === "restaurant")!.poiName).toBe(
      "R2"
    );
    expect(tops.find((t) => t.poiCategory === "bank")!.poiName).toBe("B1");
    expect(tops.find((t) => t.poiCategory === "convenience")!.poiName).toBe(
      "C1"
    );
  });

  it("getPoiCommercialByCommunityNearestAcross 跨 category 最近 Top N", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "restaurant", 1, "R1", "餐饮", 200),
      PC(1, "bank", 1, "B1", "银行", 50), // 最近
      PC(1, "convenience", 1, "C1", "便利店", 150),
      PC(1, "convenience", 2, "C2", "便利店", 70) // 第二近
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const nearest = getPoiCommercialByCommunityNearestAcross(1, 3);
    expect(nearest).toHaveLength(3);
    expect(nearest[0]!.poiName).toBe("B1"); // 50m
    expect(nearest[1]!.poiName).toBe("C2"); // 70m
    expect(nearest[2]!.poiName).toBe("C1"); // 150m
  });

  it("getPoiCommercialByCityBankCoverage 银行覆盖率", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      // city 1（community 1-9）：2 个 community（1, 11），都有银行
      PC(1, "bank", 1, "B1", "银行", 50),
      PC(11, "bank", 1, "B2", "银行", 80),
      // city 2（community 30）：有
      PC(30, "bank", 1, "B3", "银行", 90),
      // community 40（city 2）：无银行
      PC(40, "restaurant", 1, "R1", "餐饮", 100),
      PC(40, "convenience", 1, "C1", "便利店", 70)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const arr = getPoiCommercialByCityBankCoverage();
    expect(arr).toHaveLength(2);
    const c1 = arr.find((x) => x.cityId === 1)!;
    expect(c1.totalCommunities).toBe(2);
    expect(c1.bankCoveredCommunities).toBe(2);
    expect(c1.coverageRatio).toBe(1);
    const c2 = arr.find((x) => x.cityId === 2)!;
    expect(c2.totalCommunities).toBe(2);
    expect(c2.bankCoveredCommunities).toBe(1);
    expect(c2.coverageRatio).toBe(0.5);
  });

  it("getPoiCommercialByCityBankNearestByCommunity 跨城银行最近 Top", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "bank", 1, "B1", "银行", 50),
      PC(11, "bank", 1, "B2", "银行", 30), // 最近
      PC(30, "bank", 1, "B3", "银行", 90)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const arr = getPoiCommercialByCityBankNearestByCommunity(3);
    expect(arr).toHaveLength(3);
    expect(arr[0]!.communityId).toBe(11);
    expect(arr[0]!.distanceM).toBe(30);
  });

  it("getPoiCommercialCrossCommunityByCategoryDistance 跨 community 同类对比", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "restaurant", 1, "R1", "餐饮", 50),
      PC(11, "restaurant", 1, "R2", "餐饮", 100),
      PC(30, "restaurant", 1, "R3", "餐饮", 80)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const arr = getPoiCommercialCrossCommunityByCategoryDistance(
      "restaurant",
      5
    );
    expect(arr).toHaveLength(3);
    expect(arr[0]!.poiName).toBe("R1"); // 50m 最近
  });

  it("getPoiCommercialByCityRestaurantNearestByCommunity 餐饮 Top", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "restaurant", 1, "R1", "餐饮", 50),
      PC(11, "restaurant", 1, "R2", "餐饮", 100)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);
    const arr = getPoiCommercialByCityRestaurantNearestByCommunity(5);
    expect(arr).toHaveLength(2);
    expect(arr[0]!.poiName).toBe("R1");
  });

  it("getPoiCommercialByCommunityWalkScore 步行可达评分", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      // community 1: 9 POI，分布
      PC(1, "restaurant", 1, "R1", "餐饮", 50), // ≤100 → 3 分
      PC(1, "restaurant", 2, "R2", "餐饮", 150), // ≤200 → 2 分
      PC(1, "restaurant", 3, "R3", "餐饮", 400), // ≤500 → 1 分
      PC(1, "bank", 1, "B1", "银行", 80), // ≤100 → 3 分
      PC(1, "bank", 2, "B2", "银行", 200), // ≤200 → 2 分
      PC(1, "bank", 3, "B3", "银行", 600), // >500 → 0 分
      PC(1, "convenience", 1, "C1", "便利店", 90), // ≤100 → 3 分
      PC(1, "convenience", 2, "C2", "便利店", 250), // >200 ≤500 → 1 分
      PC(1, "convenience", 3, "C3", "便利店", 350) // >200 ≤500 → 1 分
    ];
    withTestCommunities(snap);
    setSnapshot(snap);

    const ws = getPoiCommercialByCommunityWalkScore(1);
    expect(ws.nearCount100).toBe(3); // R1, B1, C1
    expect(ws.nearCount200).toBe(2); // R2 (150), B2 (200)
    expect(ws.nearCount500).toBe(3); // R3 (400), C2 (250), C3 (350)
    expect(ws.walkScore).toBe(16); // 3*3 + 2*2 + 1*3 = 9 + 4 + 3 = 16
  });

  it("getPoiCommercialByCityConvenienceLeaderboard 便利店 Top", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "convenience", 1, "C1", "便利店", 40),
      PC(11, "convenience", 1, "C2", "便利店", 20), // 最近
      PC(30, "convenience", 1, "C3", "便利店", 100)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);
    const arr = getPoiCommercialByCityConvenienceLeaderboard(3);
    expect(arr[0]!.poiName).toBe("C2");
  });

  it("getPoiCommercialByPoiTypeLeaderboard 按 poiType 跨城对比", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [
      PC(1, "convenience", 1, "7-ELEVEn 店 A", "购物服务;便利店;7-ELEVEn便利店", 50),
      PC(11, "convenience", 1, "美宜佳", "购物服务;便利店;美宜佳", 30), // 不含关键字
      PC(30, "convenience", 1, "7-ELEVEn 店 B", "购物服务;便利店;7-ELEVEn便利店", 80)
    ];
    withTestCommunities(snap);
    setSnapshot(snap);
    const arr = getPoiCommercialByPoiTypeLeaderboard("7-ELEVEn", 5);
    expect(arr).toHaveLength(2);
    expect(arr[0]!.distanceM).toBe(50);
    expect(arr[1]!.distanceM).toBe(80);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.poiCommercials = [];
    setSnapshot(snap);

    expect(summarizePoiCommercialByCity()).toEqual([]);
    expect(summarizePoiCommercialByCategory()).toEqual([]);
    expect(getPoiCommercialByCommunityTopByCategory(1)).toEqual([]);
    expect(getPoiCommercialByCommunityNearestAcross(1, 3)).toEqual([]);
    expect(getPoiCommercialByCityBankCoverage()).toEqual([]);
    expect(getPoiCommercialByCityBankNearestByCommunity(10)).toEqual([]);
    expect(getPoiCommercialCrossCommunityByCategoryDistance("restaurant")).toEqual([]);
    expect(getPoiCommercialByCityRestaurantNearestByCommunity(10)).toEqual([]);
    expect(getPoiCommercialByCommunityWalkScore(1)).toEqual({
      communityId: 1,
      nearCount100: 0,
      nearCount200: 0,
      nearCount500: 0,
      walkScore: 0
    });
    expect(getPoiCommercialByCityConvenienceLeaderboard(10)).toEqual([]);
    expect(getPoiCommercialByPoiTypeLeaderboard("7-ELEVEn", 10)).toEqual([]);
  });
});