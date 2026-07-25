import { describe, expect, it } from "vitest";
import {
  getFreshestCommunityTopN,
  getStalestCommunityTopN,
  summarizeListingFreshnessByCity
} from "../src/local/listingFreshnessRanking";
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
    climate: {
      cities: [],
      globalIndex: { source: "test", updatedAt: "1970-01-01" }
    },
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
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

describe("listingFreshnessRanking", () => {
  it("summarizeListingFreshnessByCity 按城市聚合，多行合并", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [
      // 广州 2 行
      {
        cityId: 1, cityName: "广州", communityId: 13, communityName: "越秀公园东门",
        districtName: "越秀区", totalListings: 57, recent4wCount: 9, new2wCount: 3,
        staleCount: 30, freshnessScore: 26.3, medianAgeDays: 91
      },
      {
        cityId: 1, cityName: "广州", communityId: 17, communityName: "万科四季花城",
        districtName: "番禺区", totalListings: 52, recent4wCount: 7, new2wCount: 2,
        staleCount: 26, freshnessScore: 21.2, medianAgeDays: 88
      },
      // 深圳 1 行
      {
        cityId: 2, cityName: "深圳", communityId: 10, communityName: "深业上城",
        districtName: "福田区", totalListings: 50, recent4wCount: 9, new2wCount: 5,
        staleCount: 28, freshnessScore: 38.0, medianAgeDays: 94
      }
    ];
    setSnapshot(snap);

    const sum = summarizeListingFreshnessByCity();
    expect(sum).toHaveLength(2);
    // 深圳 freshness 38 > 广州 (26.3+21.2)/2 = 23.75
    expect(sum[0]!.cityId).toBe(2);
    expect(sum[0]!.cityName).toBe("深圳");
    expect(sum[0]!.avgFreshness).toBeCloseTo(38.0, 5);
    expect(sum[0]!.communityCount).toBe(1);

    expect(sum[1]!.cityId).toBe(1);
    expect(sum[1]!.cityName).toBe("广州");
    expect(sum[1]!.communityCount).toBe(2);
    // total = 109, recent4w = 16, new2w = 5, stale = 56
    expect(sum[1]!.totalListings).toBe(109);
    expect(sum[1]!.recent4wRate).toBeCloseTo(16 / 109, 5);
    expect(sum[1]!.new2wRate).toBeCloseTo(5 / 109, 5);
    expect(sum[1]!.staleRate).toBeCloseTo(56 / 109, 5);
    // avgFreshness = (26.3 + 21.2) / 2 = 23.75
    expect(sum[1]!.avgFreshness).toBeCloseTo(23.75, 5);
    // avgMedianAgeDays = (91 + 88) / 2 = 89.5
    expect(sum[1]!.avgMedianAgeDays).toBeCloseTo(89.5, 5);
  });

  it("summarizeListingFreshnessByCity 支持 cityId 过滤", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [
      {
        cityId: 1, cityName: "广州", communityId: 1, communityName: "A",
        districtName: "X", totalListings: 10, recent4wCount: 1, new2wCount: 1,
        staleCount: 5, freshnessScore: 30, medianAgeDays: 80
      },
      {
        cityId: 2, cityName: "深圳", communityId: 2, communityName: "B",
        districtName: "Y", totalListings: 20, recent4wCount: 2, new2wCount: 1,
        staleCount: 8, freshnessScore: 40, medianAgeDays: 90
      }
    ];
    setSnapshot(snap);

    const all = summarizeListingFreshnessByCity();
    expect(all).toHaveLength(2);
    const gz = summarizeListingFreshnessByCity(1);
    expect(gz).toHaveLength(1);
    expect(gz[0]!.cityId).toBe(1);
  });

  it("getFreshestCommunityTopN 排序：freshnessScore 降序 → age 升序", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [
      // 高分 30 天
      {
        cityId: 1, cityName: "广州", communityId: 1, communityName: "高分年轻",
        districtName: "D1", totalListings: 10, recent4wCount: 1, new2wCount: 1,
        staleCount: 1, freshnessScore: 40, medianAgeDays: 30
      },
      // 同分但是 age 更高 → 排后
      {
        cityId: 1, cityName: "广州", communityId: 2, communityName: "同分年长",
        districtName: "D2", totalListings: 20, recent4wCount: 2, new2wCount: 1,
        staleCount: 1, freshnessScore: 40, medianAgeDays: 60
      },
      // 低分
      {
        cityId: 1, cityName: "广州", communityId: 3, communityName: "低分老",
        districtName: "D3", totalListings: 5, recent4wCount: 0, new2wCount: 0,
        staleCount: 4, freshnessScore: 5, medianAgeDays: 200
      },
      // null medianAgeDays → 应被排到末位
      {
        cityId: 1, cityName: "广州", communityId: 4, communityName: "高分ageNull",
        districtName: "D4", totalListings: 50, recent4wCount: 5, new2wCount: 2,
        staleCount: 2, freshnessScore: 40, medianAgeDays: null
      }
    ];
    setSnapshot(snap);

    const top = getFreshestCommunityTopN(undefined, 4);
    expect(top).toHaveLength(4);
    // 期望顺序：#1 (40, 30天) → #2 (40, 60天) → #4 (40, null→infinity) → #3 (5)
    expect(top[0]!.communityName).toBe("高分年轻");
    expect(top[1]!.communityName).toBe("同分年长");
    expect(top[2]!.communityName).toBe("高分ageNull");
    expect(top[3]!.communityName).toBe("低分老");
  });

  it("getStalestCommunityTopN 排序：freshnessScore 升序 → age 降序", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [
      {
        cityId: 1, cityName: "广州", communityId: 1, communityName: "低分年长",
        districtName: "D1", totalListings: 10, recent4wCount: 1, new2wCount: 0,
        staleCount: 8, freshnessScore: 5, medianAgeDays: 250
      },
      // 同分但 age 短 → 排后
      {
        cityId: 1, cityName: "广州", communityId: 2, communityName: "低分年轻",
        districtName: "D2", totalListings: 30, recent4wCount: 1, new2wCount: 0,
        staleCount: 25, freshnessScore: 5, medianAgeDays: 100
      },
      {
        cityId: 1, cityName: "广州", communityId: 3, communityName: "中等活跃",
        districtName: "D3", totalListings: 50, recent4wCount: 5, new2wCount: 2,
        staleCount: 5, freshnessScore: 30, medianAgeDays: 80
      }
    ];
    setSnapshot(snap);

    const top = getStalestCommunityTopN(undefined, 3);
    expect(top).toHaveLength(3);
    // 期望顺序：#1 (5, 250天) → #2 (5, 100天) → #3 (30)
    expect(top[0]!.communityName).toBe("低分年长");
    expect(top[1]!.communityName).toBe("低分年轻");
    expect(top[2]!.communityName).toBe("中等活跃");
  });

  it("snapshot.listingFreshness 为空时不抛错", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [];
    setSnapshot(snap);

    expect(summarizeListingFreshnessByCity()).toEqual([]);
    expect(getFreshestCommunityTopN(undefined, 5)).toEqual([]);
    expect(getStalestCommunityTopN(undefined, 5)).toEqual([]);
  });

  it("按 cityId 过滤影响新鲜 / 积压排行", () => {
    const snap = emptySnapshot();
    snap.listingFreshness = [
      {
        cityId: 1, cityName: "广州", communityId: 1, communityName: "gz-高",
        districtName: "D", totalListings: 10, recent4wCount: 2, new2wCount: 1,
        staleCount: 1, freshnessScore: 50, medianAgeDays: 30
      },
      {
        cityId: 2, cityName: "深圳", communityId: 2, communityName: "sz-高",
        districtName: "D", totalListings: 10, recent4wCount: 2, new2wCount: 1,
        staleCount: 1, freshnessScore: 80, medianAgeDays: 20
      }
    ];
    setSnapshot(snap);

    const gzFresh = getFreshestCommunityTopN(1, 3);
    expect(gzFresh).toHaveLength(1);
    expect(gzFresh[0]!.cityId).toBe(1);
    expect(gzFresh[0]!.freshnessScore).toBe(50);

    const szFresh = getFreshestCommunityTopN(2, 3);
    expect(szFresh).toHaveLength(1);
    expect(szFresh[0]!.freshnessScore).toBe(80);
  });
});
