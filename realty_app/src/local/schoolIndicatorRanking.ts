/**
 * v0.94.0 派生：学校指标各维度 Top 5 + 趋势涨跌排行。
 *
 * 输入：`school_indicators.csv` 已通过 `LocalSchoolIndicator` 进入 snapshot.schoolIndicators，
 * 每条记录字段：latestLevelScoreRaw（综合排名分 / 0–100）、groupSchoolFlagRaw（集团校标记）、
 * groupSchoolStrengthRaw（所属集团实力 / 0–100）、districtBalanceLevelRaw（区域均衡度 / 0–100）、
 * trendDeltaRaw（连续两期得分差，正 = 上升 / 负 = 下滑）。
 *
 * 派生指标：
 *   - summarizeSchoolIndicators: 总览达标率（综合 ≥ 90）+ 集团校覆盖率 + 上升下滑比
 *   - getSchoolIndicatorDimensionTopN: 任一维度 Top N（默认 5）
 *   - getSchoolIndicatorTrendTop: 上升 / 下滑各 Top N
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getSchoolIndicators } from "./store";
import type { LocalSchoolIndicator } from "./types";

export interface SchoolIndicatorSummary {
  total: number;
  /** 综合分 ≥ 90 的学校占比 (0–1) */
  highLevelRate: number;
  /** 集团校占比 (0–1) */
  groupSchoolRate: number;
  /** 上升数 / 下滑数（trend > 0 / trend < 0） */
  risingCount: number;
  decliningCount: number;
  flatCount: number;
}

export function summarizeSchoolIndicators(): SchoolIndicatorSummary {
  const xs = getSchoolIndicators();
  const total = xs.length;
  if (total === 0) {
    return {
      total: 0,
      highLevelRate: 0,
      groupSchoolRate: 0,
      risingCount: 0,
      decliningCount: 0,
      flatCount: 0
    };
  }
  let highLevel = 0;
  let groupSchool = 0;
  let rising = 0;
  let declining = 0;
  let flat = 0;
  for (const x of xs) {
    if (x.latestLevelScoreRaw != null && x.latestLevelScoreRaw >= 90) {
      highLevel++;
    }
    if (x.groupSchoolFlagRaw === true) groupSchool++;
    if (x.trendDeltaRaw == null) continue;
    if (x.trendDeltaRaw > 0) rising++;
    else if (x.trendDeltaRaw < 0) declining++;
    else flat++;
  }
  return {
    total,
    highLevelRate: highLevel / total,
    groupSchoolRate: groupSchool / total,
    risingCount: rising,
    decliningCount: declining,
    flatCount: flat
  };
}

export type SchoolIndicatorDimension =
  | "latestLevelScoreRaw"
  | "groupSchoolStrengthRaw"
  | "districtBalanceLevelRaw";

export interface SchoolIndicatorRankingEntry {
  schoolId: number;
  /** 该维度的原始分 */
  score: number;
  /** 综合分（用于横向参考） */
  latestLevel: number | null;
  /** 是否集团校 */
  groupSchoolFlag: boolean | null;
  /** 趋势变化（用于上下文说明） */
  trendDelta: number | null;
}

/**
 * 派生任一维度的 Top N（默认 5），按分数降序。
 * 维度值为 null 的记录被过滤掉。
 */
export function getSchoolIndicatorDimensionTopN(
  dimension: SchoolIndicatorDimension,
  n: number = 5
): SchoolIndicatorRankingEntry[] {
  const xs = getSchoolIndicators();
  const ranked: SchoolIndicatorRankingEntry[] = [];
  for (const x of xs) {
    const v = x[dimension];
    if (typeof v !== "number") continue;
    ranked.push({
      schoolId: x.schoolId,
      score: v,
      latestLevel: x.latestLevelScoreRaw,
      groupSchoolFlag: x.groupSchoolFlagRaw,
      trendDelta: x.trendDeltaRaw
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, n);
}

export interface SchoolIndicatorTrendEntry {
  schoolId: number;
  trendDelta: number;
  latestLevel: number | null;
  groupSchoolFlag: boolean | null;
}

/**
 * 按 trendDeltaRaw 升/降各取 Top N。
 * 模式："rising" → trendDelta 降序（涨幅最大排前）；"declining" → trendDelta 升序（跌幅最深排前）。
 */
export function getSchoolIndicatorTrendTop(
  mode: "rising" | "declining",
  n: number = 5
): SchoolIndicatorTrendEntry[] {
  const xs = getSchoolIndicators();
  const out: SchoolIndicatorTrendEntry[] = [];
  for (const x of xs) {
    if (x.trendDeltaRaw == null) continue;
    if (mode === "rising" && x.trendDeltaRaw <= 0) continue;
    if (mode === "declining" && x.trendDeltaRaw >= 0) continue;
    out.push({
      schoolId: x.schoolId,
      trendDelta: x.trendDeltaRaw,
      latestLevel: x.latestLevelScoreRaw,
      groupSchoolFlag: x.groupSchoolFlagRaw
    });
  }
  out.sort((a, b) =>
    mode === "rising"
      ? b.trendDelta - a.trendDelta
      : a.trendDelta - b.trendDelta
  );
  return out.slice(0, n);
}

// 把"内部 raw 类型"也对外暴露一份，便于测试与 dashboard 复用
export type { LocalSchoolIndicator };
