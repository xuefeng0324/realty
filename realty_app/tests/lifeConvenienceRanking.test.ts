import { describe, expect, it } from "vitest";
import {
  getLifeConvenienceByCityDistrict,
  getLifeConvenienceByDimensionCoverage,
  getLifeConvenienceDimensionBalance,
  getLifeConveniencePareto,
  getLifeConvenienceTopByScore,
  summarizeLifeConvenienceByCity
} from "../src/local/lifeConvenienceRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalLifeConvenience
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

function LC(
  communityId: number,
  cityId: number,
  districtName: string,
  communityName: string,
  mall: number,
  park: number,
  subway: number,
  school: number,
  hospital: number,
  market: number,
  score100: number
): LocalLifeConvenience {
  // score = mall + park + subway + school + hospital + market
  const score = mall + park + subway + school + hospital + market;
  return {
    communityId,
    cityId,
    districtName,
    communityName,
    mallNear: mall,
    parkNear: park,
    subwayNear: subway,
    schoolNear: school,
    hospitalNear: hospital,
    marketNear: market,
    score,
    score100
  };
}

describe("lifeConvenienceRanking", () => {
  it("summarizeLifeConvenienceByCity 聚合 + top", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      LC(1, 2, "南山区", "A", 25, 15, 20, 10, 15, 20, 95),
      LC(2, 2, "南山区", "B", 20, 15, 15, 7, 10, 20, 79),
      LC(3, 1, "越秀区", "C", 25, 15, 25, 10, 15, 20, 100),
      LC(4, 1, "海珠区", "D", 15, 10, 5, 5, 5, 10, 50)
    ];
    setSnapshot(snap);

    const sum = summarizeLifeConvenienceByCity();
    expect(sum).toHaveLength(2);
    // 按 avgScore100 倒序：city2 (87) > city1 (75)
    expect(sum[0]!.cityId).toBe(2); // (95+79)/2 = 87
    expect(sum[0]!.avgScore100).toBeCloseTo(87, 5);
    expect(sum[0]!.top?.communityId).toBe(1); // 95
    expect(sum[1]!.cityId).toBe(1); // (100+50)/2 = 75
    expect(sum[1]!.avgScore100).toBeCloseTo(75, 5);
    // 各维度平均
    expect(sum[1]!.avgSubwayNear).toBeCloseTo(15, 5); // city1: (25+5)/2
    expect(sum[0]!.avgSubwayNear).toBeCloseTo(17.5, 5); // city2: (20+15)/2
  });

  it("getLifeConvenienceTopByScore 全市 / city 过滤", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      LC(1, 2, "南山区", "A", 0, 0, 0, 0, 0, 0, 95),
      LC(2, 2, "南山区", "B", 0, 0, 0, 0, 0, 0, 79),
      LC(3, 1, "越秀区", "C", 0, 0, 0, 0, 0, 0, 100)
    ];
    setSnapshot(snap);

    const all = getLifeConvenienceTopByScore(null, 2);
    expect(all).toHaveLength(2);
    expect(all[0]!.communityId).toBe(3); // 100
    expect(all[1]!.communityId).toBe(1); // 95

    const city2 = getLifeConvenienceTopByScore(2, 5);
    expect(city2).toHaveLength(2);
    expect(city2.every((c) => c.cityId === 2)).toBe(true);
  });

  it("getLifeConvenienceByCityDistrict 区分聚合 + rankOverall", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      LC(1, 2, "南山区", "A", 0, 0, 0, 0, 0, 0, 95),
      LC(2, 2, "南山区", "B", 0, 0, 0, 0, 0, 0, 79),
      LC(3, 2, "福田区", "C", 0, 0, 0, 0, 0, 0, 80),
      LC(4, 1, "越秀区", "D", 0, 0, 0, 0, 0, 0, 70)
    ];
    setSnapshot(snap);

    const city2 = getLifeConvenienceByCityDistrict(2);
    expect(city2).toHaveLength(2);
    expect(city2[0]!.districtName).toBe("南山区"); // (95+79)/2 = 87
    expect(city2[0]!.rankOverall).toBe(1);
    expect(city2[1]!.districtName).toBe("福田区");
    expect(city2[1]!.rankOverall).toBe(2);

    const all = getLifeConvenienceByCityDistrict();
    expect(all).toHaveLength(3);
    expect(all[0]!.districtName).toBe("南山区");
  });

  it("getLifeConvenienceByDimensionCoverage 单维度 Top N", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      LC(1, 2, "南山区", "A", 25, 5, 10, 5, 5, 5, 50),
      LC(2, 2, "南山区", "B", 20, 8, 15, 5, 5, 5, 55),
      LC(3, 2, "福田区", "C", 25, 5, 20, 5, 5, 5, 60),
      LC(4, 2, "福田区", "D", 25, 5, 25, 5, 5, 5, 65)
    ];
    setSnapshot(snap);

    const topMall = getLifeConvenienceByDimensionCoverage("mallNear", 3);
    expect(topMall).toHaveLength(3);
    expect(topMall[0]!.value).toBe(25);
    expect(topMall[0]!.dimension).toBe("mallNear");

    const topSubway = getLifeConvenienceByDimensionCoverage("subwayNear", 2);
    expect(topSubway).toHaveLength(2);
    expect(topSubway[0]!.communityId).toBe(4); // 25
  });

  it("getLifeConveniencePareto 综合高 + 某维度最强", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      LC(1, 2, "南山区", "A", 25, 5, 25, 5, 5, 5, 90),
      LC(2, 2, "南山区", "B", 25, 5, 20, 5, 5, 5, 85),
      LC(3, 2, "福田区", "C", 25, 5, 10, 5, 5, 5, 70), // score<80 过滤
      LC(4, 2, "福田区", "D", 25, 5, 15, 5, 5, 5, 80)
    ];
    setSnapshot(snap);

    const pareto = getLifeConveniencePareto("subwayNear", 80, 5);
    expect(pareto).toHaveLength(3); // score<80 过滤 C
    expect(pareto[0]!.communityId).toBe(1); // subway=25 最强
    expect(pareto[1]!.communityId).toBe(2); // subway=20
  });

  it("getLifeConvenienceDimensionBalance 检测失衡小区", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [
      // A：地铁极强 (30) 但综合分低 (55)
      LC(1, 2, "南山区", "A", 5, 5, 30, 5, 5, 5, 55),
      // B：综合高分 (90)，不应被检出
      LC(2, 2, "南山区", "B", 25, 15, 20, 10, 15, 20, 90),
      // C：mall=30 极强但综合 55
      LC(3, 2, "福田区", "C", 30, 5, 5, 5, 5, 5, 55)
    ];
    setSnapshot(snap);

    const imbalance = getLifeConvenienceDimensionBalance(60, 25, 5);
    expect(imbalance).toHaveLength(2);
    // 失衡小区 score100<60 且 strongestValue>25（严格 >）
    // B 被过滤（score100=90 >= 60）
    // A 和 C strongestValue 都是 30，按 stable sort A 在前（C 在后）
    const ids = imbalance.map((x) => x.communityId).sort();
    expect(ids).toEqual([1, 3]);
    expect(imbalance.every((x) => x.strongestValue > 25)).toBe(true);
    const dims = imbalance.map((x) => x.strongestDim).sort();
    expect(dims).toEqual(["mallNear", "subwayNear"]);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.lifeConveniences = [];
    setSnapshot(snap);

    expect(summarizeLifeConvenienceByCity()).toEqual([]);
    expect(getLifeConvenienceTopByScore(null, 5)).toEqual([]);
    expect(getLifeConvenienceByCityDistrict()).toEqual([]);
    expect(getLifeConvenienceByDimensionCoverage("mallNear", 5)).toEqual([]);
    expect(getLifeConveniencePareto("subwayNear", 80, 5)).toEqual([]);
    expect(getLifeConvenienceDimensionBalance(60, 25, 5)).toEqual([]);
  });
});