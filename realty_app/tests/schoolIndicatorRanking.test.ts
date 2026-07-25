import { describe, expect, it } from "vitest";
import {
  getSchoolIndicatorDimensionTopN,
  getSchoolIndicatorTrendTop,
  summarizeSchoolIndicators
} from "../src/local/schoolIndicatorRanking";
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

describe("schoolIndicatorRanking", () => {
  it("summarizeSchoolIndicators 计算达标率 + 集团校占比 + 涨跌比", () => {
    const snap = emptySnapshot();
    snap.schoolIndicators = [
      { schoolId: 1, latestLevelScoreRaw: 92, groupSchoolFlagRaw: true, groupSchoolStrengthRaw: 65, districtBalanceLevelRaw: 50, trendDeltaRaw: 3 },
      { schoolId: 2, latestLevelScoreRaw: 85, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 60, trendDeltaRaw: -2 },
      { schoolId: 3, latestLevelScoreRaw: 90, groupSchoolFlagRaw: true, groupSchoolStrengthRaw: 70, districtBalanceLevelRaw: 55, trendDeltaRaw: 0 },
      { schoolId: 4, latestLevelScoreRaw: 75, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 40, districtBalanceLevelRaw: 45, trendDeltaRaw: 1 },
      { schoolId: 5, latestLevelScoreRaw: null, groupSchoolFlagRaw: null, groupSchoolStrengthRaw: null, districtBalanceLevelRaw: null, trendDeltaRaw: null }
    ];
    setSnapshot(snap);

    const sum = summarizeSchoolIndicators();
    expect(sum.total).toBe(5);
    // level≥90: 1, 3 → 2 / 5 = 0.4
    expect(sum.highLevelRate).toBeCloseTo(0.4, 5);
    // 集团校: 1, 3 → 2 / 5 = 0.4
    expect(sum.groupSchoolRate).toBeCloseTo(0.4, 5);
    expect(sum.risingCount).toBe(2); // 1 (+3), 4 (+1)
    expect(sum.decliningCount).toBe(1); // 2 (-2)
    expect(sum.flatCount).toBe(1); // 3 (0)
  });

  it("getSchoolIndicatorDimensionTopN 按维度降序取 Top N，null 过滤", () => {
    const snap = emptySnapshot();
    snap.schoolIndicators = [
      { schoolId: 1, latestLevelScoreRaw: 85, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 40, districtBalanceLevelRaw: 60, trendDeltaRaw: 0 },
      { schoolId: 2, latestLevelScoreRaw: 95, groupSchoolFlagRaw: true, groupSchoolStrengthRaw: 80, districtBalanceLevelRaw: 70, trendDeltaRaw: 1 },
      { schoolId: 3, latestLevelScoreRaw: 90, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 90, districtBalanceLevelRaw: 80, trendDeltaRaw: -1 },
      { schoolId: 4, latestLevelScoreRaw: 78, groupSchoolFlagRaw: true, groupSchoolStrengthRaw: 55, districtBalanceLevelRaw: null, trendDeltaRaw: 0 },
      { schoolId: 5, latestLevelScoreRaw: null, groupSchoolFlagRaw: null, groupSchoolStrengthRaw: null, districtBalanceLevelRaw: 50, trendDeltaRaw: null }
    ];
    setSnapshot(snap);

    const lev = getSchoolIndicatorDimensionTopN("latestLevelScoreRaw");
    expect(lev).toHaveLength(4); // 5 被 null 过滤
    expect(lev.map((r) => r.schoolId)).toEqual([2, 3, 1, 4]);

    const grp = getSchoolIndicatorDimensionTopN("groupSchoolStrengthRaw", 2);
    expect(grp).toHaveLength(2);
    expect(grp[0]!.schoolId).toBe(3); // 90
    expect(grp[1]!.schoolId).toBe(2); // 80
    expect(grp[0]!.score).toBe(90);

    // districtBalanceLevelRaw: 5 (50) 在 null 过滤后实际参与
    // 但 rank 比较 groupStrengthRaw 不一样。
    const bal = getSchoolIndicatorDimensionTopN("districtBalanceLevelRaw", 5);
    expect(bal).toHaveLength(4); // 4 的 districtBalance=null 被过滤掉
    expect(bal[0]!.schoolId).toBe(3); // 80
  });

  it("getSchoolIndicatorTrendTop rising 升序看涨幅、declining 看跌幅", () => {
    const snap = emptySnapshot();
    snap.schoolIndicators = [
      { schoolId: 1, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: 0.5 },
      { schoolId: 2, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: 5 },
      { schoolId: 3, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: 2 },
      { schoolId: 4, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: -3 },
      { schoolId: 5, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: -1 },
      { schoolId: 6, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: -10 },
      { schoolId: 7, latestLevelScoreRaw: 80, groupSchoolFlagRaw: false, groupSchoolStrengthRaw: 50, districtBalanceLevelRaw: 50, trendDeltaRaw: null }
    ];
    setSnapshot(snap);

    const rising = getSchoolIndicatorTrendTop("rising");
    expect(rising).toHaveLength(3); // 排除 0 / null / 负值
    expect(rising.map((r) => r.schoolId)).toEqual([2, 3, 1]); // 5, 2, 0.5

    const decl = getSchoolIndicatorTrendTop("declining");
    expect(decl).toHaveLength(3);
    expect(decl.map((r) => r.schoolId)).toEqual([6, 4, 5]); // -10, -3, -1
  });

  it("snapshot.schoolIndicators 为空时 summary 返回 0，但不抛错", () => {
    const snap = emptySnapshot();
    snap.schoolIndicators = [];
    setSnapshot(snap);

    const sum = summarizeSchoolIndicators();
    expect(sum.total).toBe(0);
    expect(sum.highLevelRate).toBe(0);
    expect(sum.groupSchoolRate).toBe(0);
    expect(getSchoolIndicatorDimensionTopN("latestLevelScoreRaw")).toEqual([]);
    expect(getSchoolIndicatorTrendTop("rising")).toEqual([]);
  });
});
