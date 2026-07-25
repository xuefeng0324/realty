import { describe, expect, it } from "vitest";
import {
  getCommunityScoreByCommuteFastest,
  getCommunityScoreByDimensionTopN,
  getCommunityScoreByTotalTopN,
  getCommunityScorePareto,
  summarizeCommunityScoreByCity
} from "../src/local/communityScoreRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalCommunityScore } from "../src/local/types";

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

function SC(
  communityId: number,
  cityId: number,
  totalScore: number,
  commuteMinutes: number | null,
  rankCity: number,
  lifeScore = 80,
  schoolScore = 80,
  commuteScore = 80,
  districtName = "测试区",
  communityName = "小区"
): LocalCommunityScore {
  return {
    communityId,
    cityId,
    districtName,
    communityName,
    lifeScore,
    schoolScore,
    commuteMinutes,
    commuteScore,
    totalScore,
    rankCity
  };
}

describe("communityScoreRanking", () => {
  it("summarizeCommunityScoreByCity 聚合多城市均值", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 90, 30, 1, 95, 85, 95),
      SC(2, 1, 80, 40, 2, 80, 80, 80),
      SC(3, 2, 70, 50, 1, 70, 70, 70),
      SC(4, 2, 75, 60, 2, 75, 75, 75)
    ];
    setSnapshot(snap);

    const sum = summarizeCommunityScoreByCity();
    expect(sum).toHaveLength(2);

    const c1 = sum.find((s) => s.cityId === 1)!;
    expect(c1.communityCount).toBe(2);
    expect(c1.avgLifeScore).toBeCloseTo(87.5, 5);
    expect(c1.avgTotalScore).toBeCloseTo(85, 5);
    expect(c1.avgCommuteMinutes).toBeCloseTo(35, 5);

    const c2 = sum.find((s) => s.cityId === 2)!;
    expect(c2.communityCount).toBe(2);
    expect(c2.avgTotalScore).toBeCloseTo(72.5, 5);
    expect(c2.avgCommuteMinutes).toBeCloseTo(55, 5);
  });

  it("summarizeCommunityScoreByCity commuteMinutes null 不影响", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 90, null, 1),
      SC(2, 1, 80, 40, 2)
    ];
    setSnapshot(snap);
    const sum = summarizeCommunityScoreByCity();
    expect(sum).toHaveLength(1);
    expect(sum[0]!.avgCommuteMinutes).toBeCloseTo(40, 5); // 跳过 null 求均值
  });

  it("getCommunityScoreByTotalTopN 按总分排序 + cityId 过滤", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 90, 30, 1, 90, 90, 90),
      SC(2, 1, 80, 40, 2),
      SC(3, 2, 95, 25, 1),
      SC(4, 2, 70, 60, 2)
    ];
    setSnapshot(snap);

    const allTop = getCommunityScoreByTotalTopN(null, 3);
    expect(allTop).toHaveLength(3);
    expect(allTop[0]!.totalScore).toBe(95); // 跨城最高
    expect(allTop[1]!.totalScore).toBe(90);

    const city1Top = getCommunityScoreByTotalTopN(1, 5);
    expect(city1Top).toHaveLength(2);
    expect(city1Top.every((s) => s.cityId === 1)).toBe(true);
    expect(city1Top[0]!.totalScore).toBe(90);
  });

  it("getCommunityScoreByDimensionTopN 各维度 Top", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 80, 30, 1, 95, 60, 80), // life 高
      SC(2, 1, 80, 30, 2, 60, 95, 80), // school 高
      SC(3, 1, 80, 20, 3, 60, 60, 95) // commute 高
    ];
    setSnapshot(snap);

    const life = getCommunityScoreByDimensionTopN("life", null, 5);
    expect(life[0]!.communityId).toBe(1);
    expect(life[0]!.lifeScore).toBe(95);

    const school = getCommunityScoreByDimensionTopN("school", null, 5);
    expect(school[0]!.communityId).toBe(2);

    const commute = getCommunityScoreByDimensionTopN("commute", null, 5);
    expect(commute[0]!.communityId).toBe(3);
  });

  it("getCommunityScoreByCommuteFastest commuteMinutes null 排到末尾", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 80, null, 1),
      SC(2, 1, 80, 10, 2),
      SC(3, 1, 80, 20, 3)
    ];
    setSnapshot(snap);

    const fast = getCommunityScoreByCommuteFastest(null, 5);
    expect(fast[0]!.communityId).toBe(2); // 10 min 最快
    expect(fast[1]!.communityId).toBe(3); // 20 min
    expect(fast[2]!.communityId).toBe(1); // null 末尾
  });

  it("getCommunityScorePareto 综合≥阈值且通勤最快", () => {
    const snap = emptySnapshot();
    snap.communityScores = [
      SC(1, 1, 90, 30, 1), // total ≥ 80, commute 30
      SC(2, 1, 95, 15, 2), // total ≥ 80, commute 15
      SC(3, 1, 70, 5, 3), // total < 80 被过滤
      SC(4, 1, 85, null, 4) // null 会被放最后
    ];
    setSnapshot(snap);

    const pareto = getCommunityScorePareto(null, 80, 5);
    expect(pareto).toHaveLength(3); // 总共 4 但 total<80 的被过滤
    expect(pareto[0]!.communityId).toBe(2); // 通勤最快 15min
    expect(pareto[1]!.communityId).toBe(1); // 30min
    expect(pareto[2]!.communityId).toBe(4); // null 末尾
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.communityScores = [];
    setSnapshot(snap);

    expect(summarizeCommunityScoreByCity()).toEqual([]);
    expect(getCommunityScoreByTotalTopN(null, 5)).toEqual([]);
    expect(getCommunityScoreByDimensionTopN("life", null, 5)).toEqual([]);
    expect(getCommunityScoreByCommuteFastest(null, 5)).toEqual([]);
    expect(getCommunityScorePareto(null, 80, 5)).toEqual([]);
  });
});