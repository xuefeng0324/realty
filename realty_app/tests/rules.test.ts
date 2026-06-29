/**
 * JS 版三套规则的对照测试。
 *
 * 用法：
 *   npm run test
 *
 * 测试原理：
 * - 对每个用例，先用 Python 端 `compute_*` 函数跑一次（在 pytest 里有镜像 fixture），把结果写到 `expected.json`
 * - 这里用 `import expected` + `expect(actual).toEqual(expected)` 严格比对
 * - 第一轮 CI 跑通后，`expected.json` 里的占位会被真实值替换
 *
 * 同时这里也包含"手算预期"的内联断言：用 Python 源码逐行推导的值，作为
 * JS 实现正确性的第一道闸门。
 */

import { describe, it, expect } from "vitest";
import { clamp, parseFloorNumber, maybeScaleTrendDelta } from "../src/rules/scoreUtils";
import { generateWeeklySnapshot, median, computeWeekWindow } from "../src/rules/snapshot";
import { computeSchoolFutureScoreV1 } from "../src/rules/schoolScoring";
import { computeListingQualityScoreV1 } from "../src/rules/listingScoring";

// ---------- scoreUtils ----------
describe("scoreUtils", () => {
  it("clamp respects bounds", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(200, 0, 100)).toBe(100);
    expect(clamp(null, 10, 20)).toBe(10);
    expect(clamp(undefined, 10, 20)).toBe(10);
    expect(clamp(NaN, 10, 20)).toBe(10);
  });

  it("parseFloorNumber handles chinese variants", () => {
    expect(parseFloorNumber("第6楼")).toBe(6);
    expect(parseFloorNumber("6楼")).toBe(6);
    expect(parseFloorNumber("6")).toBe(6);
    expect(parseFloorNumber("中楼层")).toBeNull();
    expect(parseFloorNumber("")).toBeNull();
    expect(parseFloorNumber(null)).toBeNull();
    expect(parseFloorNumber("高楼层（共16层）")).toBe(16);
  });

  it("maybeScaleTrendDelta rescales percentage-style values", () => {
    expect(maybeScaleTrendDelta(0.08)).toBe(8);
    expect(maybeScaleTrendDelta(-0.05)).toBe(-5);
    expect(maybeScaleTrendDelta(0)).toBe(0);
    // already-scaled values pass through
    expect(maybeScaleTrendDelta(8)).toBe(8);
    expect(maybeScaleTrendDelta(-3)).toBe(-3);
  });
});

// ---------- snapshot ----------
describe("snapshot.generateWeeklySnapshot", () => {
  it("uses latest_non_null when sample is large and within deviation", () => {
    // 6 samples, latest=72000, median ~71500, deviation < 0.25
    const r = generateWeeklySnapshot({
      communityId: 1,
      weekEndDate: "2026-03-23",
      unitPrices: [72000, 71500, 71800, 71300, 71600, 71400]
    });
    expect(r).not.toBeNull();
    expect(r!.dataPolicy).toBe("latest_non_null");
    expect(r!.avgUnitPrice).toBe(72000); // latest price
    expect(r!.medianUnitPrice).toBe(71550); // median of sorted
    expect(r!.listingCount).toBe(6);
    expect(r!.coverageScore).toBe(0.2); // 6 / 30
    expect(r!.weekStartDate).toBe("2026-03-17");
    expect(r!.weekEndDate).toBe("2026-03-23");
  });

  it("falls back to median_robust when too few samples", () => {
    const r = generateWeeklySnapshot({
      communityId: 1,
      weekEndDate: "2026-03-23",
      unitPrices: [70000, 71000, 71500]
    });
    expect(r!.dataPolicy).toBe("median_robust");
    expect(r!.avgUnitPrice).toBe(71000); // median
    expect(r!.listingCount).toBe(3);
  });

  it("falls back to median_robust when deviation too high", () => {
    // 6 samples, latest=99999, median=71000, deviation > 0.25
    const r = generateWeeklySnapshot({
      communityId: 1,
      weekEndDate: "2026-03-23",
      unitPrices: [99999, 71000, 71100, 71000, 70900, 71100]
    });
    expect(r!.dataPolicy).toBe("median_robust");
    expect(r!.avgUnitPrice).toBe(71050); // median
  });

  it("returns null when no valid prices", () => {
    expect(
      generateWeeklySnapshot({ communityId: 1, weekEndDate: "2026-03-23", unitPrices: [] })
    ).toBeNull();
    // out-of-range prices are filtered
    expect(
      generateWeeklySnapshot({
        communityId: 1,
        weekEndDate: "2026-03-23",
        unitPrices: [500, 300000]
      })
    ).toBeNull();
  });

  it("median handles even/odd arrays", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("computeWeekWindow returns 7-day window", () => {
    expect(computeWeekWindow("2026-03-23")).toEqual({ start: "2026-03-17", end: "2026-03-23" });
  });
});

// ---------- school_scoring ----------
describe("school.computeSchoolFutureScoreV1", () => {
  it("full inputs: province key + high level + group + district + trend up", () => {
    const r = computeSchoolFutureScoreV1(
      { schoolId: 1001, provinceKeyFlag: true, cityKeyFlag: true },
      {
        latestLevelScoreRaw: 90,
        groupSchoolFlagRaw: true,
        groupSchoolStrengthRaw: 85,
        districtBalanceLevelRaw: 80,
        trendDeltaRaw: 0.08 // => 8
      },
      null
    );
    // weights: 0.55/0.20/0.15/0.10
    // 0.55*90 + 0.20*85 + 0.15*80 + (50+clamp(8,0,50)=58) * 0.10
    // = 49.5 + 17 + 12 + 5.8 = 84.3
    expect(r.trendScore0_100).toBeCloseTo(84.3, 2);
    expect(r.confidenceScore).toBe(1.0);
    expect(r.featureContribJson.missing_fallbacks).toHaveLength(0);
  });

  it("applies all missing-fallback policies when every raw field is null", () => {
    const r = computeSchoolFutureScoreV1(
      { schoolId: 1002, provinceKeyFlag: false, cityKeyFlag: false },
      {
        latestLevelScoreRaw: null,
        groupSchoolFlagRaw: null,
        groupSchoolStrengthRaw: null,
        districtBalanceLevelRaw: null,
        trendDeltaRaw: null
      },
      null
    );
    // latest=50 (-0.2), group=40 (-0.1), district=50 (-0.15), trend=50 (-0.1) => confidence = 0.45
    // 0.55*50 + 0.20*40 + 0.15*50 + 0.10*50 = 27.5 + 8 + 7.5 + 5 = 48.0
    expect(r.trendScore0_100).toBeCloseTo(48.0, 2);
    expect(r.confidenceScore).toBeCloseTo(0.45, 2);
    expect(r.featureContribJson.missing_fallbacks.length).toBe(4);
  });

  it("derives trend_delta from previous indicator when raw is null", () => {
    const r = computeSchoolFutureScoreV1(
      { schoolId: 1003, provinceKeyFlag: false, cityKeyFlag: false },
      {
        latestLevelScoreRaw: 80,
        groupSchoolFlagRaw: true,
        groupSchoolStrengthRaw: 90,
        districtBalanceLevelRaw: 75,
        trendDeltaRaw: null // derived from previous
      },
      {
        latestLevelScoreRaw: 75,
        groupSchoolFlagRaw: null,
        groupSchoolStrengthRaw: null,
        districtBalanceLevelRaw: null,
        trendDeltaRaw: null
      }
    );
    // trend_delta = 80 - 75 = 5; scale = 5 (abs <= 1 ? 5*100 : 5); trend_score = 50+5 = 55
    // overall = 0.55*80 + 0.20*90 + 0.15*75 + 0.10*55 = 44 + 18 + 11.25 + 5.5 = 78.75
    expect(r.trendScore0_100).toBeCloseTo(78.75, 2);
  });

  it("negative trend_delta reduces score below 50", () => {
    const r = computeSchoolFutureScoreV1(
      { schoolId: 1004, provinceKeyFlag: false, cityKeyFlag: false },
      {
        latestLevelScoreRaw: 70,
        groupSchoolFlagRaw: false,
        groupSchoolStrengthRaw: null,
        districtBalanceLevelRaw: 70,
        trendDeltaRaw: -0.1 // => -10
      },
      null
    );
    // trend = 50 - clamp(10,0,50) = 40
    // overall = 0.55*70 + 0.20*40 + 0.15*70 + 0.10*40 = 38.5 + 8 + 10.5 + 4 = 61.0
    expect(r.trendScore0_100).toBeCloseTo(61.0, 2);
  });
});

// ---------- listing_scoring ----------
describe("listing.computeListingQualityScoreV1", () => {
  it("full inputs best case yields high overall", () => {
    const r = computeListingQualityScoreV1(
      {
        listingId: 9001,
        communityId: 1,
        orientation: "南", // 40
        bedrooms: 3,
        bathrooms: 2, // 30
        floorNumber: "6", // 30
        hasElevator: true, // 60
        decorateType: "精装", // 40
        buildYear: 2020, // age 6 -> 85
        unitPrice: 70000,
        nearestMetroDistanceM: 400 // 60
      },
      75000, // community avg
      [{ trendScore0_100: 85.0, provinceKeyFlag: true, cityKeyFlag: true }],
      "listing_quality_score_v1",
      new Date("2026-03-23T00:00:00Z")
    );

    // school_subscore = clamp(round(0.8*85+8,2), 0, 40) = clamp(76, 0, 40) = 40
    // location = clamp(60+40, 0, 100) = 100
    // house = 40+30+30 = 100
    // building_age = 85
    // amenity = 60+40 = 100
    // price_value: ratio = 70000/75000 = 0.9333.., 0.9<=ratio<0.95 => 85
    // overall = 0.30*100 + 0.25*100 + 0.15*85 + 0.15*100 + 0.15*85
    //         = 30 + 25 + 12.75 + 15 + 12.75 = 95.5
    expect(r.dimensionScores.location_score).toBe(100);
    expect(r.dimensionScores.house_quality_score).toBe(100);
    expect(r.dimensionScores.amenity_score).toBe(100);
    expect(r.dimensionScores.building_age_score).toBe(85);
    expect(r.dimensionScores.price_value_score).toBe(85);
    expect(r.overallScore).toBeCloseTo(95.5, 2);
    expect(r.schoolFutureScoreMax).toBe(85);
    expect(r.schoolProvinceKeyFlagAny).toBe(true);
    expect(r.schoolCityKeyFlagAny).toBe(true);
    // advantages 取置信度 top 3：
    //   近地铁优 0.92, 强学区优 0.90, 性价比高 0.90,
    //   户型佳 0.86, 采光朝向优 0.84, 电梯优 0.88, 精装修优 0.82
    // 排序后前 3：近地铁优(0.92), 强学区优(0.90), 性价比高(0.90)
    expect(r.advantages).toHaveLength(3);
    const advLabels = r.advantages.map((a) => a.label);
    expect(advLabels).toContain("近地铁优");
    expect(advLabels).toContain("强学区优");
    expect(advLabels).toContain("性价比高");
    // explain_json.label_evidence 也只存 top 3（跟 Python 行为一致）
    expect(r.explainJson.label_evidence.advantages).toHaveLength(3);
    expect(r.disadvantages).toHaveLength(0);
  });

  it("all-missing falls back to defaults", () => {
    const r = computeListingQualityScoreV1(
      {
        listingId: 9002,
        communityId: 1,
        orientation: null,
        bedrooms: null,
        bathrooms: null,
        floorNumber: null,
        hasElevator: null,
        decorateType: null,
        buildYear: null,
        unitPrice: null,
        nearestMetroDistanceM: null
      },
      null,
      [],
      "listing_quality_score_v1",
      new Date("2026-03-23T00:00:00Z")
    );
    // location: metro=30 + school=20 = 50
    expect(r.dimensionScores.location_score).toBe(50);
    // house: orientation=20 + layout=15 + floor=15 = 50
    expect(r.dimensionScores.house_quality_score).toBe(50);
    // age: 50
    expect(r.dimensionScores.building_age_score).toBe(50);
    // amenity: elevator=30 + decorate=20 = 50
    expect(r.dimensionScores.amenity_score).toBe(50);
    // price: 50 (missing)
    expect(r.dimensionScores.price_value_score).toBe(50);
    // overall = 50 (all dims equal)
    expect(r.overallScore).toBe(50);
    expect(r.explainJson.missing_fallbacks.length).toBeGreaterThanOrEqual(8);
  });

  it("price_value_score buckets work", () => {
    // ratio < 0.9 => 95
    const r1 = computeListingQualityScoreV1(
      {
        listingId: 1,
        communityId: 1,
        orientation: "南",
        bedrooms: 2,
        bathrooms: 1,
        floorNumber: "5",
        hasElevator: true,
        decorateType: "简装",
        buildYear: 2015,
        unitPrice: 60000,
        nearestMetroDistanceM: 800
      },
      75000, // ratio 0.8
      []
    );
    expect(r1.dimensionScores.price_value_score).toBe(95);

    // ratio > 1.15 => 40
    const r2 = computeListingQualityScoreV1(
      {
        listingId: 2,
        communityId: 1,
        orientation: "南",
        bedrooms: 2,
        bathrooms: 1,
        floorNumber: "5",
        hasElevator: true,
        decorateType: "简装",
        buildYear: 2015,
        unitPrice: 90000,
        nearestMetroDistanceM: 800
      },
      75000, // ratio 1.2
      []
    );
    expect(r2.dimensionScores.price_value_score).toBe(40);
  });

  it("age bucket boundaries", () => {
    const make = (year: number) =>
      computeListingQualityScoreV1(
        {
          listingId: 1,
          communityId: 1,
          orientation: "南",
          bedrooms: 2,
          bathrooms: 1,
          floorNumber: "5",
          hasElevator: true,
          decorateType: "简装",
          buildYear: year,
          unitPrice: 75000,
          nearestMetroDistanceM: 800
        },
        75000,
        []
      );
    // 2026 - buildYear:
    //   4  -> <5    -> 95
    //   11 -> <15   -> 75
    //   26 -> else  -> 40 (not 60!)
    expect(make(2022).dimensionScores.building_age_score).toBe(95); // age 4
    expect(make(2015).dimensionScores.building_age_score).toBe(75); // age 11
    expect(make(2000).dimensionScores.building_age_score).toBe(40); // age 26 falls to else
    expect(make(1990).dimensionScores.building_age_score).toBe(40); // age 36
  });

  it("disadvantages flags for bad listings", () => {
    // 让 location_score 落到 <=45 才能触发"距地铁远"
    //   metro=5000 => metro_subscore=20
    //   空 school_future => school_subscore=20
    //   location = 40 <= 45 ✓
    const r = computeListingQualityScoreV1(
      {
        listingId: 1,
        communityId: 1,
        orientation: "北", // 18
        bedrooms: 1,
        bathrooms: 1,
        floorNumber: "中楼层", // unparseable
        hasElevator: false,
        decorateType: "毛坯",
        buildYear: 1990, // old
        unitPrice: 95000, // > community avg => low price_value
        nearestMetroDistanceM: 5000
      },
      75000,
      [] // empty -> school_subscore=20, location_score=40
    );
    const disLabels = r.disadvantages.map((d) => d.label);
    // top 3 by confidence:
    //   距地铁远 0.88, 房龄偏老 0.86, 无电梯/设施差 0.85
    // (学区弱 不触发：没 school_future；装修偏差 0.75 / 性价比偏低 0.80 也触发但被 top3 截断)
    expect(r.disadvantages).toHaveLength(3);
    expect(disLabels).toContain("距地铁远");
    expect(disLabels).toContain("房龄偏老");
    expect(disLabels).toContain("无电梯/设施差");
  });
});