import { describe, expect, it } from "vitest";
import {
  getCityByCompositeRank,
  getSchoolDimensionByDimensionTopN,
  getSchoolDimensionPolymath,
  summarizeSchoolDimensionsByCity
} from "../src/local/schoolDimensionRanking";
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
    listingTagSummaries: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

const SH = (
  schoolId: number,
  schoolName: string,
  cityId: number,
  cityName: string,
  lvl: number,
  grp: number,
  bal: number,
  trend: number,
  composite: number,
  districtName = "",
  isGroup = 0
) => ({
  cityId,
  cityName,
  schoolId,
  schoolName,
  districtName,
  schoolType: "中学",
  levelScore: lvl,
  isGroup,
  groupStrength: grp,
  districtBalance: bal,
  trendDelta: trend,
  compositeScore: composite
});

describe("schoolDimensionRanking", () => {
  it("summarizeSchoolDimensionsByCity 计算每市平均 composite + trend", () => {
    const snap = emptySnapshot();
    snap.schoolDimensions = [
      SH(1, "甲", 1, "广州", 90, 70, 80, 5, 75),
      SH(2, "乙", 1, "广州", 85, 60, 70, 3, 65),
      SH(3, "丙", 2, "深圳", 95, 80, 85, 4, 85)
    ];
    setSnapshot(snap);

    const sum = summarizeSchoolDimensionsByCity();
    expect(sum).toHaveLength(2);
    // 深圳 avgComposite 85 > 广州 (75+65)/2=70
    expect(sum[0]!.cityName).toBe("深圳");
    expect(sum[0]!.schoolCount).toBe(1);
    expect(sum[0]!.avgComposite).toBeCloseTo(85, 5);
    expect(sum[0]!.avgTrendDelta).toBeCloseTo(4, 5);

    expect(sum[1]!.cityName).toBe("广州");
    expect(sum[1]!.schoolCount).toBe(2);
    expect(sum[1]!.avgComposite).toBeCloseTo(70, 5);
    expect(sum[1]!.avgTrendDelta).toBeCloseTo(4, 5);
  });

  it("getSchoolDimensionByDimensionTopN 按各维度降序", () => {
    const snap = emptySnapshot();
    snap.schoolDimensions = [
      SH(1, "A", 1, "广州", 85, 60, 70, 0, 60),
      SH(2, "B", 1, "广州", 95, 80, 85, 0, 80),
      SH(3, "C", 2, "深圳", 90, 75, 80, 0, 70),
      SH(4, "D", 2, "深圳", 100, 100, 100, 0, 100)
    ];
    setSnapshot(snap);

    const byL = getSchoolDimensionByDimensionTopN("levelScore", undefined, 5);
    expect(byL[0]!.schoolName).toBe("D"); // 100
    expect(byL[1]!.schoolName).toBe("B"); // 95
    expect(byL[3]!.schoolName).toBe("A"); // 85

    const byG = getSchoolDimensionByDimensionTopN("groupStrength", 1, 2);
    // 广州：A groupStrength=60, B=80 → B 应排前
    expect(byG).toHaveLength(2);
    expect(byG[0]!.schoolName).toBe("B");

    const byB = getSchoolDimensionByDimensionTopN("districtBalance", 2, 5);
    expect(byB[0]!.schoolName).toBe("D");
    expect(byB[1]!.schoolName).toBe("C");
  });

  it("getSchoolDimensionPolymath 默认阈值 (80/70/70) 取全维度学校", () => {
    const snap = emptySnapshot();
    snap.schoolDimensions = [
      // 全维度合格
      SH(1, "六边形战士", 1, "广州", 90, 80, 85, 0, 80),
      // 综合分高但 groupStrength 不达标
      SH(2, "差点六边形", 1, "广州", 95, 50, 80, 0, 75),
      // 综合分高但 districtBalance 不达标
      SH(3, "偏科生", 2, "深圳", 90, 80, 50, 0, 75),
      // 全维度不达标
      SH(4, "普通", 2, "深圳", 70, 60, 60, 0, 60)
    ];
    setSnapshot(snap);

    const poly = getSchoolDimensionPolymath(undefined);
    expect(poly).toHaveLength(1);
    expect(poly[0]!.schoolName).toBe("六边形战士");
    expect(poly[0]!.score).toBe(80);

    // 用更宽松阈值：80/40/40（levelScore 仍 80 默值）
    // 六边形 (90/80/85) ✓、差点六边形 (95/50/80) ✓、偏科 (90/80/50) ✓
    // 普通 (70/60/60) × → 共 3
    const loose = getSchoolDimensionPolymath(undefined, {
      groupStrengthMin: 40,
      districtBalanceMin: 40
    });
    expect(loose).toHaveLength(3);
    expect(loose.map((s) => s.schoolName)).toEqual([
      "六边形战士",
      "差点六边形",
      "偏科生"
    ]);
  });

  it("getCityByCompositeRank 每市返回综合得分最高的学校", () => {
    const snap = emptySnapshot();
    snap.schoolDimensions = [
      SH(1, "广-甲", 1, "广州", 90, 70, 80, 0, 60),
      SH(2, "广-乙", 1, "广州", 95, 80, 85, 0, 80),
      SH(3, "深-甲", 2, "深圳", 90, 70, 80, 0, 85)
    ];
    setSnapshot(snap);

    const ranked = getCityByCompositeRank();
    expect(ranked).toHaveLength(2);
    // 深圳 85 > 广州 80 → 深圳第一
    expect(ranked[0]!.cityId).toBe(2);
    expect(ranked[0]!.topSchool?.schoolName).toBe("深-甲");
    expect(ranked[1]!.cityId).toBe(1);
    expect(ranked[1]!.topSchool?.schoolName).toBe("广-乙");
  });

  it("snapshot.schoolDimensions 为空时不抛错", () => {
    const snap = emptySnapshot();
    snap.schoolDimensions = [];
    setSnapshot(snap);

    expect(summarizeSchoolDimensionsByCity()).toEqual([]);
    expect(getSchoolDimensionByDimensionTopN("levelScore", undefined, 5)).toEqual(
      []
    );
    expect(getSchoolDimensionPolymath(undefined)).toEqual([]);
    expect(getCityByCompositeRank()).toEqual([]);
  });
});
