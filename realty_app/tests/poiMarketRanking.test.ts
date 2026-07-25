import { describe, expect, it } from "vitest";
import {
  getPoiMarketByCategoryRanking,
  getPoiMarketDistanceLeaderboard,
  getPoiMarketNearestByCommunity,
  summarizePoiMarketByCommunity
} from "../src/local/poiMarketRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot } from "../src/local/types";

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

const MP = (
  communityId: number,
  rank: number,
  name: string,
  category: string,
  distanceM: number,
  address = ""
) => ({
  communityId,
  rank,
  poiName: name,
  poiCategory: "market",
  poiTypeCategory: category,
  distanceM,
  lat: 22.5,
  lng: 113.9,
  address
});

describe("poiMarketRanking", () => {
  it("summarizePoiMarketByCommunity 聚合最近 / 最远距离 + market 名", () => {
    const snap = emptySnapshot();
    snap.poiMarkets = [
      MP(1, 1, "A", "综合市场", 80),
      MP(1, 2, "B", "综合市场", 200),
      MP(1, 3, "C", "综合市场", 500),
      MP(2, 1, "D", "蔬菜市场", 350),
      MP(2, 2, "E", "综合市场", 600)
    ];
    setSnapshot(snap);

    const sum = summarizePoiMarketByCommunity();
    expect(sum).toHaveLength(2);
    expect(sum[0]!.communityId).toBe(1);
    expect(sum[0]!.nearestDistanceM).toBe(80);
    expect(sum[0]!.farthestDistanceM).toBe(500);
    expect(sum[0]!.nearestName).toBe("A");
    expect(sum[0]!.marketCount).toBe(3);

    expect(sum[1]!.communityId).toBe(2);
    expect(sum[1]!.nearestDistanceM).toBe(350);
    expect(sum[1]!.marketCount).toBe(2);
  });

  it("getPoiMarketNearestByCommunity 优先取 rank=1，回退到最近距离", () => {
    const snap = emptySnapshot();
    // 小区 1：rank=1 + 2 + 3 标准
    snap.poiMarkets = [
      MP(1, 1, "X", "综合市场", 80),
      MP(1, 2, "Y", "综合市场", 200),
      // 小区 2：只有 rank=2，无 rank=1
      MP(2, 2, "Z", "蔬菜市场", 350)
    ];
    setSnapshot(snap);

    const n1 = getPoiMarketNearestByCommunity(1);
    expect(n1).not.toBeNull();
    expect(n1!.poiName).toBe("X");
    expect(n1!.distanceM).toBe(80);

    const n2 = getPoiMarketNearestByCommunity(2);
    expect(n2).not.toBeNull();
    expect(n2!.poiName).toBe("Z");
    expect(n2!.distanceM).toBe(350);

    const none = getPoiMarketNearestByCommunity(99);
    expect(none).toBeNull();
  });

  it("getPoiMarketDistanceLeaderboard 取最近 / 最远 N 个", () => {
    const snap = emptySnapshot();
    snap.poiMarkets = [
      MP(1, 1, "A", "综合市场", 50),
      MP(2, 1, "B", "综合市场", 1000),
      MP(3, 1, "C", "综合市场", 80),
      MP(4, 1, "D", "综合市场", 500),
      MP(5, 1, "E", "综合市场", 30)
    ];
    setSnapshot(snap);

    const lb = getPoiMarketDistanceLeaderboard(3);
    expect(lb.nearest).toHaveLength(3);
    expect(lb.nearest[0]!.nearestDistanceM).toBe(30);   // E
    expect(lb.nearest[1]!.nearestDistanceM).toBe(50);   // A
    expect(lb.nearest[2]!.nearestDistanceM).toBe(80);   // C

    expect(lb.farthest).toHaveLength(3);
    expect(lb.farthest[0]!.nearestDistanceM).toBe(1000); // B
    expect(lb.farthest[1]!.nearestDistanceM).toBe(500);  // D
  });

  it("getPoiMarketByCategoryRanking 按类别 count 倒序 + 平均距离", () => {
    const snap = emptySnapshot();
    snap.poiMarkets = [
      MP(1, 1, "A", "综合市场", 80),
      MP(1, 2, "B", "综合市场", 200),
      MP(2, 1, "C", "综合市场", 350),
      MP(2, 2, "D", "蔬菜市场", 150),
      MP(3, 1, "E", "蔬菜市场", 250)
    ];
    setSnapshot(snap);

    const cat = getPoiMarketByCategoryRanking();
    expect(cat).toHaveLength(2);
    expect(cat[0]!.category).toBe("综合市场");
    expect(cat[0]!.count).toBe(3);
    expect(cat[0]!.avgDistanceM).toBeCloseTo((80 + 200 + 350) / 3, 5);

    expect(cat[1]!.category).toBe("蔬菜市场");
    expect(cat[1]!.count).toBe(2);
    expect(cat[1]!.avgDistanceM).toBeCloseTo(200, 5);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.poiMarkets = [];
    setSnapshot(snap);

    expect(summarizePoiMarketByCommunity()).toEqual([]);
    expect(getPoiMarketNearestByCommunity(1)).toBeNull();
    expect(getPoiMarketDistanceLeaderboard(5).nearest).toEqual([]);
    expect(getPoiMarketDistanceLeaderboard(5).farthest).toEqual([]);
    expect(getPoiMarketByCategoryRanking()).toEqual([]);
  });
});
