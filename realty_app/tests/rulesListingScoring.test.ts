import { describe, expect, it } from "vitest";
import {
  computeListingQualityScoreV1,
  type ListingInput,
  type SchoolFutureForListing
} from "../src/rules/listingScoring";

/**
 * listing_quality_score_v1 单测。
 *
 * 5 维度加权（location 0.30 / house 0.25 / age 0.15 / amenity 0.15 / price 0.15）
 * + adv/dis 标签 top3 截断（按 confidence 降序）+ missing_fallbacks 列出
 * 所有 NULL 字段的策略。
 *
 * 覆盖重点：
 *   - metro < 500 → 60 / 500-1000 → 50 / 1000-2000 → 35 / >2000 → 20
 *   - schoolFutureScoreMax 空 → fallback 20
 *   - schoolFutureScoreMax 用 0.8x + 8 公式钳到 [0, 40]
 *   - orientation 表查（南/南北/东西/东/西/北/南北通透/其他/空）
 *   - layout 4 分支（>=3&>=2 / ==3&==1 / ==2 / <=1）
 *   - floor 4 段（3-10 / 11-15 / 16-25 / >25 / <=2）
 *   - building_age 5 段（<5 / <10 / <15 / <20 / >=20）
 *   - price_value 5 段（<0.9 / <0.95 / ≤1.05 / ≤1.15 / >1.15）
 *   - adv/dis 阈值触发（近地铁/强学区/户型佳/朝向优/电梯优/精装/性价比高 + 反向）
 */
describe("rules/listingScoring 房源评分 v1", () => {
  // 用 2026-01-01 锁定 buildYear 相关计算
  const NOW = new Date("2026-01-01T00:00:00Z");

  const baseListing: ListingInput = {
    listingId: 1,
    communityId: 100,
    orientation: "南",
    bedrooms: 3,
    bathrooms: 2,
    floorNumber: "8/30",
    hasElevator: true,
    decorateType: "精装",
    buildYear: 2020,
    unitPrice: 60000,
    nearestMetroDistanceM: 400
  };

  const baseSchool: SchoolFutureForListing = {
    trendScore0_100: 80,
    provinceKeyFlag: true,
    cityKeyFlag: false
  };

  const baseCommunityAvg = 60000;

  describe("happy path（所有指标完整）", () => {
    it("返回 5 维度分数 + overall 加权 + top3 adv/dis", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [baseSchool],
        "listing_quality_score_v1",
        NOW
      );
      expect(r.overallScore).toBeGreaterThan(60);
      expect(r.overallScore).toBeLessThanOrEqual(100);
      expect(Object.keys(r.dimensionScores)).toEqual([
        "location_score",
        "house_quality_score",
        "building_age_score",
        "amenity_score",
        "price_value_score"
      ]);
      expect(r.advantages.length).toBeLessThanOrEqual(3);
      expect(r.disadvantages.length).toBeLessThanOrEqual(3);
    });

    it("explainJson 含 rule_version + inputs_snapshot + dimension_scores + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(baseListing, baseCommunityAvg, [baseSchool], undefined, NOW);
      expect(r.explainJson.rule_version).toBe("listing_quality_score_v1");
      expect(r.explainJson.inputs_snapshot.bedroom_count).toBe(3);
      expect(r.explainJson.missing_fallbacks).toEqual([]);
    });

    it("ruleVersion 透传", () => {
      const r = computeListingQualityScoreV1(baseListing, baseCommunityAvg, [baseSchool], "v2_test", NOW);
      expect(r.explainJson.rule_version).toBe("v2_test");
    });

    it("schoolFutureScoreMax 取最大", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [
          { ...baseSchool, trendScore0_100: 60 },
          { ...baseSchool, trendScore0_100: 85 },
          { ...baseSchool, trendScore0_100: 70 }
        ],
        undefined,
        NOW
      );
      expect(r.schoolFutureScoreMax).toBe(85);
    });

    it("schoolProvinceKeyFlagAny 在任一 school 为 true 时为 true，否则 null", () => {
      const r1 = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [
          { trendScore0_100: 80, provinceKeyFlag: false, cityKeyFlag: false }
        ],
        undefined,
        NOW
      );
      expect(r1.schoolProvinceKeyFlagAny).toBe(null);
      expect(r1.schoolCityKeyFlagAny).toBe(null);

      const r2 = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [
          { trendScore0_100: 80, provinceKeyFlag: true, cityKeyFlag: false }
        ],
        undefined,
        NOW
      );
      expect(r2.schoolProvinceKeyFlagAny).toBe(true);
      expect(r2.schoolCityKeyFlagAny).toBe(null);
    });
  });

  describe("metro 距离子分（4 段）", () => {
    it("< 500 → 60", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: 400 },
        baseCommunityAvg,
        [baseSchool],
        undefined, NOW
      );
      expect(r.dimensionScores.location_score).toBeGreaterThanOrEqual(60);
    });

    it("500-1000 → 50", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: 800 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.location_score).toBeGreaterThanOrEqual(50);
    });

    it("1000-2000 → 35", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: 1500 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.location_score).toBeGreaterThanOrEqual(35);
    });

    it("> 2000 → 20", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: 3000 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.location_score).toBeLessThanOrEqual(45);
    });

    it("NULL → 30 fallback + missing_fallbacks 标记", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      const ff = (r.explainJson.missing_fallbacks as any[]).find((f) => f.field === "nearest_metro_distance_m");
      expect(ff).toEqual({ field: "nearest_metro_distance_m", policy: "set_to_30", reason: "NULL" });
    });
  });

  describe("school 子分公式", () => {
    it("空 schools → fallback 20 + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [],
        undefined, NOW
      );
      expect(r.schoolFutureScoreMax).toBe(null);
      const ff = (r.explainJson.missing_fallbacks as any[]).find((f) => f.field === "school_future_scores");
      expect(ff).toEqual({ field: "school_future_scores", policy: "set_to_20", reason: "EMPTY" });
    });

    it("全 null trendScore → 当作空 → fallback 20", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [
          { trendScore0_100: null, provinceKeyFlag: null, cityKeyFlag: null }
        ],
        undefined, NOW
      );
      expect(r.schoolFutureScoreMax).toBe(null);
    });

    it("score=80 → 0.8*80+8=72 → clamp 到 40（school 子分上限 40）", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 80 }],
        undefined, NOW
      );
      expect(r.schoolFutureScoreMax).toBe(80);
      // location_score = metro(60) + school(40) = 100
      expect(r.dimensionScores.location_score).toBe(100);
    });

    it("score=10 → 0.8*10+8=16（< 40 不 clamp）", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, nearestMetroDistanceM: 5000 }, // metro 子分 20
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 10 }],
        undefined, NOW
      );
      expect(r.dimensionScores.location_score).toBe(36); // 20 + 16
    });
  });

  describe("orientation 查表", () => {
    it.each([
      ["南", 40],
      ["南北", 36],
      ["东西", 34],
      ["东", 34],
      ["西", 28],
      ["东/西", 34],
      ["北", 18],
      ["其他", 25],
      ["南北通透", 36],
      [null, 20], // 空
      ["未知朝向", 25] // 未识别 → 用 "其他" 25
    ])("orientation=%s → subscore=%i", (orientation, expected) => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, orientation: orientation as any },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      // location_score = metro(60) + school(20) = 80
      // house_quality_score = orientation(expected) + layout(30) + floor(30) = 60+expected
      // 验证 house_quality = 60 + expected（layout/floor 用基线最高）
      expect(r.dimensionScores.house_quality_score).toBe(60 + expected);
    });
  });

  describe("layout 子分（bedrooms × bathrooms）", () => {
    it("bedrooms>=3 & bathrooms>=2 → 30", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, bedrooms: 4, bathrooms: 2 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.house_quality_score).toBeGreaterThanOrEqual(60 + 30);
    });

    it("bedrooms==3 & bathrooms==1 → 23", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, bedrooms: 3, bathrooms: 1 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.house_quality_score).toBe(70 + 23);
    });

    it("bedrooms==2 → 20", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, bedrooms: 2, bathrooms: 1 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.house_quality_score).toBe(70 + 20);
    });

    it("bedrooms<=1 → 10", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, bedrooms: 1, bathrooms: 1 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.house_quality_score).toBe(70 + 10);
    });

    it("bedrooms null → 15 fallback + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, bedrooms: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      const ff = (r.explainJson.missing_fallbacks as any[]).find((f) => f.field === "bedrooms");
      expect(ff).toEqual({ field: "bedrooms", policy: "set_layout_to_15", reason: "NULL" });
    });
  });

  describe("floor 子分（5 段）", () => {
    it.each([
      [5, 30], // 3-10 段
      [10, 30],
      [11, 24], // 11-15 段
      [15, 24],
      [16, 18], // 16-25 段
      [25, 18],
      [30, 12], // >25 段
      [2, 10], // <3 段（≤2）
      [-1, 10] // 负数（B1 之类）也是 ≤2 → 10
    ])("floor=%i → subscore=%i", (floor, expected) => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, floorNumber: String(floor), bedrooms: 1, bathrooms: 1 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      // house_quality = orientation(40) + layout(10) + floor(expected)
      expect(r.dimensionScores.house_quality_score).toBe(40 + 10 + expected);
    });

    it("floorNumber null / 不可解析 → 15 fallback + missing_fallbacks", () => {
      const r1 = computeListingQualityScoreV1(
        { ...baseListing, floorNumber: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      const ff1 = (r1.explainJson.missing_fallbacks as any[]).find((f) => f.field === "floor_number");
      expect(ff1).toEqual({ field: "floor_number", policy: "set_to_15", reason: "NULL_OR_UNPARSEABLE" });
    });
  });

  describe("building_age 子分（5 段，依赖 nowDate）", () => {
    it.each([
      [2024, 95], // age=2 <5
      [2020, 85], // age=6 <10
      [2014, 75], // age=12 <15
      [2009, 60], // age=17 <20
      [2000, 40] // age=26 >=20
    ])("buildYear=%i (now=2026) → subscore=%i", (buildYear, expected) => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, buildYear, orientation: "未知朝向", bedrooms: 1, bathrooms: 1, floorNumber: "1/30", decorateType: "毛坯", hasElevator: false, nearestMetroDistanceM: 5000 },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.building_age_score).toBe(expected);
    });

    it("buildYear null → 50 fallback + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, buildYear: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.building_age_score).toBe(50);
      const ff = (r.explainJson.missing_fallbacks as any[]).find((f) => f.field === "build_year");
      expect(ff).toEqual({ field: "build_year", policy: "set_to_50", reason: "NULL" });
    });
  });

  describe("amenity 子分（elevator + decorate）", () => {
    it("hasElevator=true → 60", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, hasElevator: true, decorateType: "毛坯" },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      // 60 + 18 = 78
      expect(r.dimensionScores.amenity_score).toBe(78);
    });

    it("hasElevator=false → 25", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, hasElevator: false, decorateType: "毛坯" },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      // 25 + 18 = 43
      expect(r.dimensionScores.amenity_score).toBe(43);
    });

    it.each([
      ["精装", 40],
      ["简装", 28],
      ["毛坯", 18],
      ["未知", 22], // decorateMap 没匹配 → 22
      [null, 20] // 空 → fallback 20
    ])("decorateType=%s → decorate subscore=%i", (decorate, expected) => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, hasElevator: true, decorateType: decorate as any },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      // 60 + expected
      expect(r.dimensionScores.amenity_score).toBe(60 + expected);
    });

    it("hasElevator null → 30 fallback + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, hasElevator: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      const ff = (r.explainJson.missing_fallbacks as any[]).find((f) => f.field === "has_elevator");
      expect(ff).toEqual({ field: "has_elevator", policy: "set_to_30", reason: "NULL" });
    });
  });

  describe("price_value 子分（ratio=unit/community_avg，5 段）", () => {
    it("ratio<0.9 → 95（便宜）", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: 50000 }, // ratio=0.83
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(95);
    });

    it("ratio 0.9-0.95 → 85", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: 56000 }, // ratio=0.933
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(85);
    });

    it("ratio ≤1.05 → 70（持平）", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: 60000 }, // ratio=1.0
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(70);
    });

    it("ratio ≤1.15 → 55", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: 65000 }, // ratio=1.083
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(55);
    });

    it("ratio >1.15 → 40（贵）", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: 80000 }, // ratio=1.33
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(40);
    });

    it("unitPrice null → 50 fallback + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        { ...baseListing, unitPrice: null },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(50);
      const ff = (r.explainJson.missing_fallbacks as any[]).find(
        (f) => f.field === "unit_price_or_community_avg_unit_price"
      );
      expect(ff).toBeTruthy();
    });

    it("communityAvgUnitPrice <=0 → 50 fallback + missing_fallbacks", () => {
      const r = computeListingQualityScoreV1(
        baseListing,
        0,
        [{ ...baseSchool, trendScore0_100: 0 }],
        undefined, NOW
      );
      expect(r.dimensionScores.price_value_score).toBe(50);
    });
  });

  describe("adv/dis 标签 top3 截断", () => {
    it("完美房源触发多个 adv，截断到 top3 按 confidence 降序", () => {
      const r = computeListingQualityScoreV1(
        {
          ...baseListing,
          orientation: "南",
          bedrooms: 4,
          bathrooms: 2,
          floorNumber: "8/30",
          hasElevator: true,
          decorateType: "精装",
          unitPrice: 50000, // ratio 0.83 → price_value=95 触发 "性价比高"
          nearestMetroDistanceM: 400 // < 1000 触发 "近地铁优"
        },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 90 }], // >= 80 触发 "强学区优"
        undefined, NOW
      );
      expect(r.advantages.length).toBe(3);
      // 排序降序：confidence 0.92(近地铁) > 0.90(强学区/性价比) > 0.88(电梯) > 0.86(户型) > 0.84(朝向) > 0.82(精装)
      expect(r.advantages[0].label).toBe("近地铁优");
      expect(r.advantages[0].confidence).toBe(0.92);
    });

    it("差房源触发多个 dis，截断到 top3", () => {
      // 构造各 dis 都触发的输入：
      //   - "距地铁远" 0.88: metroDist > 2000 & location_score ≤ 45
      //     → 需要 metro=20 + school=20 → schoolTrend <= 15 (clamp(0.8*15+8,0,40)=20)
      //   - "学区弱" 0.82: schoolFutureScoreMax < 60 → 同上
      //   - "房龄偏老" 0.86: buildingAgeScore <= 50 → buildYear < 2006
      //   - "无电梯" 0.85: hasElevator=false & amenityScore <= 45
      //     → elevator=25 + decorate=18(毛坯) = 43 ≤ 45 ✓
      //   - "装修偏差" 0.75: decorateType="毛坯" ✓
      //   - "性价比偏低" 0.80: priceValueScore <= 55 → ratio > 1.15 → unitPrice > 60000*1.15
      const r = computeListingQualityScoreV1(
        {
          ...baseListing,
          orientation: "北", // 18
          bedrooms: 1,
          bathrooms: 1,
          floorNumber: "30/30",
          hasElevator: false,
          decorateType: "毛坯",
          buildYear: 1990,
          unitPrice: 80000,
          nearestMetroDistanceM: 5000
        },
        baseCommunityAvg,
        [{ ...baseSchool, trendScore0_100: 10 }], // schoolSubscore=20 → location=40 ≤ 45
        undefined, NOW
      );
      expect(r.disadvantages.length).toBeGreaterThanOrEqual(3);
      expect(r.disadvantages[0].label).toBe("距地铁远"); // 0.88
    });
  });

  describe("overall 加权（5 维度 × 权重）", () => {
    it("所有维度满分时 overall = 100", () => {
      // 构造各维度都拿最高分
      const r = computeListingQualityScoreV1(
        {
          ...baseListing,
          orientation: "南", // 40
          bedrooms: 4,
          bathrooms: 2, // layout 30
          floorNumber: "8/30", // floor 30
          hasElevator: true, // 60
          decorateType: "精装", // 40
          buildYear: 2024, // age<5 → 95
          unitPrice: 1, // ratio < 0.9 → 95
          nearestMetroDistanceM: 100 // <500 → 60
        },
        1000, // community avg 比 unitPrice 大很多 → ratio 极小
        [{ ...baseSchool, trendScore0_100: 100 }], // school_subscore=clamp(88,0,40)=40
        undefined, NOW
      );
      // location = 60 + 40 = 100
      // house_quality = 40+30+30 = 100
      // building_age = 95
      // amenity = 60+40 = 100
      // price_value = 95
      // overall = 0.3*100 + 0.25*100 + 0.15*95 + 0.15*100 + 0.15*95 = 30+25+14.25+15+14.25 = 98.5
      expect(r.overallScore).toBe(98.5);
    });
  });

  describe("所有字段 NULL → 完整 fallback 路径", () => {
    it("所有字段 null，overall 是有限数 + 所有 missing_fallbacks 都被记录", () => {
      const r = computeListingQualityScoreV1(
        {
          listingId: 1,
          communityId: 100,
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
        undefined, NOW
      );
      // 5 维度都有 fallback：location=30+20=50, house_quality=20+15+15=50,
      // building_age=50, amenity=30+20=50, price_value=50
      // overall = 0.3*50 + 0.25*50 + 0.15*50 + 0.15*50 + 0.15*50 = 50
      expect(r.overallScore).toBe(50);
      expect((r.explainJson.missing_fallbacks as any[]).length).toBeGreaterThanOrEqual(7);
    });
  });
});