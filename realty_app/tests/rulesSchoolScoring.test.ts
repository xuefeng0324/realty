import { describe, expect, it } from "vitest";
import {
  computeSchoolFutureScoreV1,
  type SchoolIndicator,
  type SchoolStandardized
} from "../src/rules/schoolScoring";

/**
 * 学校未来评分规则 v1 单测。
 *
 * 重要约束：
 *   - 4 因子加权：latest (0.55) + group (0.20) + district (0.15) + trend (0.10)
 *   - 每个因子有 NULL fallback：missing 1 个扣对应 confidence（0.05 / 0.1 / 0.15 / 0.2）
 *   - trendDeltaScore：deltaScaled > 0 → 50 + clamp(deltaScaled, 0, 50)；
 *                    否则 50 - clamp(|deltaScaled|, 0, 50)
 *   - 最终 trendScore 必 clamp 到 [0, 100]
 *
 * 14 个用例覆盖：4 因子 NULL fallback 各一 + group=true/false/null 三个分支
 * + trend delta 上升 / 下降 / 已 scale / 未 scale + previousIndicator 反推
 * + 完整 happy path 校验权重和。
 */
describe("rules/schoolScoring 学校未来评分 v1", () => {
  const baseSchool: SchoolStandardized = {
    schoolId: 1,
    provinceKeyFlag: true,
    cityKeyFlag: true
  };

  const fullLatest: SchoolIndicator = {
    latestLevelScoreRaw: 80,
    groupSchoolFlagRaw: true,
    groupSchoolStrengthRaw: 70,
    districtBalanceLevelRaw: 60,
    trendDeltaRaw: 0.05
  };

  describe("happy path（所有指标完整）", () => {
    it("加权聚合 + 置信度 1.0 + 不触发 fallback", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, fullLatest, null);
      // latest: 0.55 * 80 = 44
      // group: 0.20 * 70 = 14
      // district: 0.15 * 60 = 9
      // trend: 0.05 -> maybeScale -> 5, delta>0 -> 50+5 = 55; 0.10 * 55 = 5.5
      // trendScore = 44 + 14 + 9 + 5.5 = 72.5
      expect(result.trendScore0_100).toBe(72.5);
      expect(result.confidenceScore).toBe(1.0);
      expect(result.featureContribJson.missing_fallbacks).toEqual([]);
      expect(result.featureContribJson.inputs_used).toEqual({
        latest_level_score: 80,
        group_school_bonus: 70,
        district_balance_bonus: 60,
        trend_delta_score: 55,
        province_key_flag: true,
        city_key_flag: true
      });
      expect(result.featureContribJson.contribution).toEqual({
        latest_contrib: 44,
        group_contrib: 14,
        district_contrib: 9,
        trend_delta_contrib: 5.5
      });
    });

    it("ruleVersion 默认是 'school_future_score_v1'", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, fullLatest, null);
      expect(result.ruleVersion).toBe("school_future_score_v1");
    });

    it("ruleVersion 透传", () => {
      const result = computeSchoolFutureScoreV1(
        baseSchool,
        fullLatest,
        null,
        "school_future_score_v2_test"
      );
      expect(result.ruleVersion).toBe("school_future_score_v2_test");
      expect(result.featureContribJson.rule_version).toBe("school_future_score_v2_test");
    });

    it("explainText 含 4 因子展开 + 缺失条数 + 置信度", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, fullLatest, null);
      expect(result.explainText).toContain("趋势分 72.50");
      expect(result.explainText).toContain("最新办学水平(0.55*80)");
      expect(result.explainText).toContain("集团化办学(0.20*70)");
      expect(result.explainText).toContain("区县均衡(0.15*60)");
      expect(result.explainText).toContain("缺失回退条目数=0");
      expect(result.explainText).toContain("置信度=1.00");
    });
  });

  describe("NULL fallback（每个因子单独缺失）", () => {
    it("latestLevelScoreRaw null → fallback 50 + 扣 0.2 置信度", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        latestLevelScoreRaw: null
      }, null);
      expect(result.confidenceScore).toBe(0.8);
      expect(result.featureContribJson.missing_fallbacks).toContainEqual({
        field: "latest_level_score_raw",
        policy: "set_to_50",
        reason: "NULL"
      });
      expect(result.featureContribJson.inputs_used.latest_level_score).toBe(50);
    });

    it("groupSchoolFlagRaw null → bonus 40 + 扣 0.1 置信度", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        groupSchoolFlagRaw: null
      }, null);
      expect(result.confidenceScore).toBe(0.9);
      expect(result.featureContribJson.missing_fallbacks).toContainEqual({
        field: "group_school_flag_raw",
        policy: "set_to_40",
        reason: "NULL"
      });
      expect(result.featureContribJson.inputs_used.group_school_bonus).toBe(40);
    });

    it("groupSchoolFlagRaw=false（明确 false 走非集团分支）→ bonus 40 不扣置信度", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        groupSchoolFlagRaw: false,
        groupSchoolStrengthRaw: 90 // 即使有 strength，也不用
      }, null);
      expect(result.confidenceScore).toBe(1.0);
      expect(result.featureContribJson.inputs_used.group_school_bonus).toBe(40);
      // 不应有 group_school_flag_raw 的 fallback 条目
      expect(
        result.featureContribJson.missing_fallbacks.find(
          (f) => f.field === "group_school_flag_raw"
        )
      ).toBeUndefined();
    });

    it("groupSchoolFlagRaw=true 但 groupSchoolStrengthRaw null → bonus 80 + 扣 0.05", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        groupSchoolFlagRaw: true,
        groupSchoolStrengthRaw: null
      }, null);
      expect(result.confidenceScore).toBe(0.95);
      expect(result.featureContribJson.inputs_used.group_school_bonus).toBe(80);
      expect(result.featureContribJson.missing_fallbacks).toContainEqual({
        field: "group_school_strength_raw",
        policy: "set_to_80",
        reason: "NULL"
      });
    });

    it("districtBalanceLevelRaw null → fallback 50 + 扣 0.15", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        districtBalanceLevelRaw: null
      }, null);
      expect(result.confidenceScore).toBe(0.85);
      expect(result.featureContribJson.missing_fallbacks).toContainEqual({
        field: "district_balance_level_raw",
        policy: "set_to_50",
        reason: "NULL"
      });
      expect(result.featureContribJson.inputs_used.district_balance_bonus).toBe(50);
    });

    it("trendDeltaRaw null + previousIndicator null → fallback 50 + 扣 0.1", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: null
      }, null);
      expect(result.confidenceScore).toBe(0.9);
      expect(result.featureContribJson.missing_fallbacks).toContainEqual({
        field: "trend_delta_raw",
        policy: "set_to_50",
        reason: "NULL"
      });
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(50);
    });

    it("trendDeltaRaw null 但 previousIndicator 提供了最新 vs 上期分数 → 自动反推 delta", () => {
      const previous: SchoolIndicator = {
        latestLevelScoreRaw: 70,
        groupSchoolFlagRaw: null,
        groupSchoolStrengthRaw: null,
        districtBalanceLevelRaw: null,
        trendDeltaRaw: null
      };
      const result = computeSchoolFutureScoreV1(
        baseSchool,
        { ...fullLatest, trendDeltaRaw: null },
        previous
      );
      // delta = 80 - 70 = 10 (已 scale)；delta>0 → 50 + clamp(10, 0, 50) = 60
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(60);
      // 0.10 * 60 = 6 贡献
      expect(result.featureContribJson.contribution.trend_delta_contrib).toBe(6);
      // 不应有 trend_delta_raw 的 fallback（用 previous 反推成功）
      expect(
        result.featureContribJson.missing_fallbacks.find(
          (f) => f.field === "trend_delta_raw"
        )
      ).toBeUndefined();
    });
  });

  describe("trend delta 计算分支", () => {
    it("delta > 0（小数 0.05）→ maybeScale 乘 100 → 50 + 5 = 55", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: 0.05
      }, null);
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(55);
    });

    it("delta < 0（-0.10）→ |scaled|=10 → 50 - 10 = 40", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: -0.1
      }, null);
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(40);
    });

    it("delta 已 scale（abs > 1）→ 直接当 score 用：delta=20 > 0 → 50 + clamp(20,0,50)=70", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: 20
      }, null);
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(70);
    });

    it("delta 极端大（200）→ clamp 到 [0,50] → 50+50=100，最终 trendScore 钳到 100", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: 200
      }, null);
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(100);
      // 最终 trendScore 钳到 100
      expect(result.trendScore0_100).toBeLessThanOrEqual(100);
    });

    it("delta 极端负（-200）→ clamp |200| 到 50 → 50-50=0", () => {
      const result = computeSchoolFutureScoreV1(baseSchool, {
        ...fullLatest,
        trendDeltaRaw: -200
      }, null);
      expect(result.featureContribJson.inputs_used.trend_delta_score).toBe(0);
    });
  });

  describe("边界：所有指标都 NULL → confidence 钳到 [0,1]", () => {
    it("全部 NULL，confidence 至少 0.2（1.0 - 0.55 = 0.45，仍 >= 0）", () => {
      const allNull: SchoolIndicator = {
        latestLevelScoreRaw: null,
        groupSchoolFlagRaw: null,
        groupSchoolStrengthRaw: null,
        districtBalanceLevelRaw: null,
        trendDeltaRaw: null
      };
      const result = computeSchoolFutureScoreV1(baseSchool, allNull, null);
      // confidence = 1.0 - 0.2 - 0.1 - 0.15 - 0.1 = 0.45
      expect(result.confidenceScore).toBe(0.45);
      expect(result.featureContribJson.missing_fallbacks.length).toBe(4);
      // trendScore 仍是有限数
      expect(Number.isFinite(result.trendScore0_100)).toBe(true);
    });
  });
});