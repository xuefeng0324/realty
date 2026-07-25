import { describe, expect, it } from "vitest";
import {
  getTagCombinationCrossCityByTag,
  getTagCombinationCrossCityMostCommon,
  getTagCombinationPopularByCity,
  getTagCombinationPremiumByCity,
  summarizeTagCombinationByCity
} from "../src/local/tagCombinationRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalTagCombination } from "../src/local/types";

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

function TC(
  cityId: number,
  cityName: string,
  tagA: string,
  tagB: string,
  count: number,
  share: number,
  avgUnitPrice: number | null
): LocalTagCombination {
  return { cityId, cityName, tagA, tagB, count, share, avgUnitPrice };
}

describe("tagCombinationRanking", () => {
  it("summarizeTagCombinationByCity 聚合 city 维度", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [
      TC(1, "广州", "名校区", "朝南", 314, 0.0475, 56126),
      TC(1, "广州", "名校区", "带电梯", 302, 0.0457, 56798),
      TC(1, "广州", "朝南", "楼龄新", 168, 0.0254, 55289),
      TC(2, "深圳", "名校区", "朝南", 250, 0.03, 75000)
    ];
    setSnapshot(snap);

    const sum = summarizeTagCombinationByCity();
    expect(sum).toHaveLength(2);

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.combinationCount).toBe(3);
    expect(gz.totalListings).toBe(314 + 302 + 168);
    expect(gz.avgShare).toBeCloseTo((0.0475 + 0.0457 + 0.0254) / 3, 5);
    expect(gz.avgCount).toBeCloseTo((314 + 302 + 168) / 3, 5);

    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.combinationCount).toBe(1);
    expect(sz.totalListings).toBe(250);
  });

  it("getTagCombinationPopularByCity 按 count 倒序", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [
      TC(1, "广州", "A", "B", 314, 0.04, 50000),
      TC(1, "广州", "A", "C", 302, 0.04, 50000),
      TC(1, "广州", "B", "C", 168, 0.025, 50000)
    ];
    setSnapshot(snap);

    const top = getTagCombinationPopularByCity(1, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.tagA).toBe("A");
    expect(top[0]!.tagB).toBe("B");
    expect(top[0]!.count).toBe(314);
    expect(top[1]!.count).toBe(302);
  });

  it("getTagCombinationPremiumByCity null 排到末尾", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [
      TC(1, "广州", "A", "B", 100, 0.01, null),
      TC(1, "广州", "A", "C", 80, 0.01, 75000),
      TC(1, "广州", "B", "C", 90, 0.01, 60000)
    ];
    setSnapshot(snap);

    const top = getTagCombinationPremiumByCity(1, 3);
    expect(top).toHaveLength(3);
    expect(top[0]!.avgUnitPrice).toBe(75000);
    expect(top[1]!.avgUnitPrice).toBe(60000);
    expect(top[2]!.avgUnitPrice).toBeNull(); // null 末尾
  });

  it("getTagCombinationCrossCityMostCommon 跨城共现的 pair", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [
      TC(1, "广州", "名校区", "朝南", 314, 0.0475, 56126),
      TC(2, "深圳", "朝南", "名校区", 250, 0.03, 85000), // 同 pair
      TC(1, "广州", "A", "B", 50, 0.01, 50000), // 仅广州
      TC(3, "珠海", "C", "D", 30, 0.01, 40000) // 仅珠海
    ];
    setSnapshot(snap);

    const cross = getTagCombinationCrossCityMostCommon(5);
    // "名校区|朝南" 出现 2 城，其他都只 1 城
    expect(cross).toHaveLength(1);
    // 不强求 tagA/tagB 顺序（实现里用 sorted key，tagA 是字典序在前那个）
    const pair = [cross[0]!.tagA, cross[0]!.tagB].sort();
    expect(pair).toEqual(["名校区", "朝南"]);
    expect(cross[0]!.cities).toHaveLength(2);
    expect(cross[0]!.cities).toContain("广州");
    expect(cross[0]!.cities).toContain("深圳");
    expect(cross[0]!.totalCount).toBe(564);
  });

  it("getTagCombinationCrossCityByTag 某 tag 跨城组合对象", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [
      TC(1, "广州", "名校区", "朝南", 314, 0.04, null),
      TC(2, "深圳", "名校区", "朝南", 200, 0.03, null),
      TC(1, "广州", "名校区", "带电梯", 100, 0.015, null),
      TC(3, "珠海", "名校区", "朝南", 50, 0.01, null)
    ];
    setSnapshot(snap);

    const r = getTagCombinationCrossCityByTag("名校区", 5);
    expect(r).not.toBeNull();
    expect(r!.baseTag).toBe("名校区");
    // 朝南：3 城 × count
    const sun = r!.pairs.find((p) => p.otherTag === "朝南");
    expect(sun).toBeDefined();
    expect(sun!.cities).toBe(3);
    expect(sun!.totalCount).toBe(314 + 200 + 50);
    // 带电梯：1 城 × count
    const elev = r!.pairs.find((p) => p.otherTag === "带电梯");
    expect(elev!.cities).toBe(1);

    expect(getTagCombinationCrossCityByTag("不存在的标签")).toBeNull();
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.tagCombinations = [];
    setSnapshot(snap);

    expect(summarizeTagCombinationByCity()).toEqual([]);
    expect(getTagCombinationPopularByCity(1, 5)).toEqual([]);
    expect(getTagCombinationPremiumByCity(1, 5)).toEqual([]);
    expect(getTagCombinationCrossCityMostCommon(5)).toEqual([]);
    expect(getTagCombinationCrossCityByTag("名校区", 5)).toBeNull();
  });
});