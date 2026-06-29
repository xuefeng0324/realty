/**
 * school_future_score_v1 规则，对应 Python 端 `realty/backend/app/services/school_scoring.py`。
 */

import { clamp, maybeScaleTrendDelta, type MissingFallback } from "./scoreUtils";

export interface SchoolIndicator {
  latestLevelScoreRaw: number | null;
  groupSchoolFlagRaw: boolean | null;
  groupSchoolStrengthRaw: number | null;
  districtBalanceLevelRaw: number | null;
  trendDeltaRaw: number | null;
}

export interface SchoolStandardized {
  schoolId: number;
  provinceKeyFlag: boolean | null;
  cityKeyFlag: boolean | null;
}

export interface SchoolFutureScoreResult {
  ruleVersion: string;
  trendScore0_100: number;
  confidenceScore: number;
  featureContribJson: Record<string, any>;
  explainText: string;
}

function norm0to100(x: number | null | undefined): number | null {
  if (x == null) return null;
  return clamp(Number(x), 0.0, 100.0);
}

export function computeSchoolFutureScoreV1(
  school: SchoolStandardized,
  latestIndicator: SchoolIndicator,
  previousIndicator: SchoolIndicator | null,
  ruleVersion: string = "school_future_score_v1"
): SchoolFutureScoreResult {
  let confidence = 1.0;
  const missingFallbacks: MissingFallback[] = [];

  // latest_level_score
  let latestLevelScore = norm0to100(latestIndicator.latestLevelScoreRaw);
  if (latestLevelScore == null) {
    latestLevelScore = 50.0;
    confidence -= 0.2;
    missingFallbacks.push({ field: "latest_level_score_raw", policy: "set_to_50", reason: "NULL" });
  }

  // group
  const groupFlag = latestIndicator.groupSchoolFlagRaw;
  let groupSchoolBonus: number;
  if (groupFlag == null) {
    groupSchoolBonus = 40.0;
    confidence -= 0.1;
    missingFallbacks.push({ field: "group_school_flag_raw", policy: "set_to_40", reason: "NULL" });
  } else if (groupFlag === true) {
    const strength = norm0to100(latestIndicator.groupSchoolStrengthRaw);
    if (strength == null) {
      groupSchoolBonus = 80.0;
      confidence -= 0.05;
      missingFallbacks.push({ field: "group_school_strength_raw", policy: "set_to_80", reason: "NULL" });
    } else {
      groupSchoolBonus = strength;
    }
  } else {
    groupSchoolBonus = 40.0;
  }

  // district
  let districtBalanceBonus = norm0to100(latestIndicator.districtBalanceLevelRaw);
  if (districtBalanceBonus == null) {
    districtBalanceBonus = 50.0;
    confidence -= 0.15;
    missingFallbacks.push({ field: "district_balance_level_raw", policy: "set_to_50", reason: "NULL" });
  }

  // trend delta
  let trendDeltaRaw = latestIndicator.trendDeltaRaw;
  if (
    trendDeltaRaw == null &&
    previousIndicator != null &&
    latestIndicator.latestLevelScoreRaw != null &&
    previousIndicator.latestLevelScoreRaw != null
  ) {
    trendDeltaRaw =
      Number(latestIndicator.latestLevelScoreRaw) - Number(previousIndicator.latestLevelScoreRaw);
  }

  let trendDeltaScore: number;
  if (trendDeltaRaw == null) {
    trendDeltaScore = 50.0;
    confidence -= 0.1;
    missingFallbacks.push({ field: "trend_delta_raw", policy: "set_to_50", reason: "NULL" });
  } else {
    const deltaScaled = maybeScaleTrendDelta(Number(trendDeltaRaw));
    if (deltaScaled > 0) {
      trendDeltaScore = 50.0 + clamp(deltaScaled, 0.0, 50.0);
    } else {
      trendDeltaScore = 50.0 - clamp(Math.abs(deltaScaled), 0.0, 50.0);
    }
    trendDeltaScore = clamp(trendDeltaScore, 0.0, 100.0);
  }

  // weights
  const wLatest = 0.55;
  const wGroup = 0.2;
  const wDistrict = 0.15;
  const wTrend = 0.1;

  const trendScore =
    wLatest * latestLevelScore +
    wGroup * groupSchoolBonus +
    wDistrict * districtBalanceBonus +
    wTrend * trendDeltaScore;
  const trendScoreClamped = clamp(trendScore, 0.0, 100.0);

  const latestContrib = wLatest * latestLevelScore;
  const groupContrib = wGroup * groupSchoolBonus;
  const districtContrib = wDistrict * districtBalanceBonus;
  const trendContrib = wTrend * trendDeltaScore;

  const explainText =
    `趋势分 ${trendScoreClamped.toFixed(2)}：最新办学水平(${wLatest.toFixed(2)}*${latestLevelScore.toFixed(0)})，` +
    `集团化办学(${wGroup.toFixed(2)}*${groupSchoolBonus.toFixed(0)})，` +
    `区县均衡(${wDistrict.toFixed(2)}*${districtBalanceBonus.toFixed(0)})，` +
    `近两期变化(${wTrend.toFixed(2)}*${trendDeltaScore.toFixed(0)})。` +
    `缺失回退条目数=${missingFallbacks.length}，` +
    `置信度=${clamp(confidence, 0.0, 1.0).toFixed(2)}。`;

  const featureContribJson = {
    rule_version: ruleVersion,
    inputs_used: {
      latest_level_score: latestLevelScore,
      group_school_bonus: groupSchoolBonus,
      district_balance_bonus: districtBalanceBonus,
      trend_delta_score: trendDeltaScore,
      province_key_flag: school.provinceKeyFlag,
      city_key_flag: school.cityKeyFlag
    },
    weights: {
      latest: wLatest,
      group: wGroup,
      district: wDistrict,
      trend_delta: wTrend
    },
    contribution: {
      latest_contrib: latestContrib,
      group_contrib: groupContrib,
      district_contrib: districtContrib,
      trend_delta_contrib: trendContrib
    },
    missing_fallbacks: missingFallbacks,
    confidence_score: clamp(confidence, 0.0, 1.0)
  };

  return {
    ruleVersion,
    trendScore0_100: Math.round(trendScoreClamped * 100) / 100,
    confidenceScore: Math.round(clamp(confidence, 0.0, 1.0) * 10000) / 10000,
    featureContribJson,
    explainText
  };
}