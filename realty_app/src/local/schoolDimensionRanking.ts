/**
 * v0.97.0 派生：重点学校维度细分 (LocalSchoolDimension)。
 *
 * 输入：snapshot.schoolDimensions（50 行），每行代表某重点学校 5 维度（levelScore /
 * groupStrength / districtBalance / trendDelta / compositeScore）+ 学校名 / 区 / 类型。
 *
 * 派生指标：
 *   - summarizeSchoolDimensionsByCity: 每市统计（学校数 / 平均 composite / 平均 trendDelta）
 *   - getSchoolDimensionByDimensionTopN: 三个核心维度（level / groupStrength / districtBalance）
 *     各取 Top N
 *   - getSchoolDimensionPolymath: 在多维度都 > 阈值的"六边形战士"学校
 *   - getCityByCompositeRank: 每市综合得分最高的学校
 *
 * 与 schoolIndicatorRanking.ts（基于 school_indicators.csv 60 行）平行，但
 * 这里用 school_dimensions.csv 的重点学校子集（50 行，名字齐全），更适合 UI 展示。
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getSchoolDimensions } from "./store";
import type { LocalSchoolDimension } from "./types";

export interface CityDimensionSummary {
  cityId: number;
  cityName: string;
  schoolCount: number;
  avgComposite: number;
  avgTrendDelta: number | null;
}

export interface SchoolDimensionEntry {
  schoolId: number;
  schoolName: string;
  cityId: number;
  cityName: string;
  districtName: string;
  schoolType: string;
  score: number;
  trendDelta: number | null;
  isGroup: number;
  compositeScore: number | null;
}

export type SchoolDimensionKey = "levelScore" | "groupStrength" | "districtBalance";

export function summarizeSchoolDimensionsByCity(): CityDimensionSummary[] {
  const all = getSchoolDimensions();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalSchoolDimension[]>();
  for (const s of all) {
    let arr = grouped.get(s.cityId);
    if (!arr) {
      arr = [];
      grouped.set(s.cityId, arr);
    }
    arr.push(s);
  }
  const out: CityDimensionSummary[] = [];
  for (const arr of grouped.values()) {
    let cSum = 0;
    let cN = 0;
    let tSum = 0;
    let tN = 0;
    for (const s of arr) {
      if (typeof s.compositeScore === "number" && Number.isFinite(s.compositeScore)) {
        cSum += s.compositeScore;
        cN += 1;
      }
      if (typeof s.trendDelta === "number" && Number.isFinite(s.trendDelta)) {
        tSum += s.trendDelta;
        tN += 1;
      }
    }
    out.push({
      cityId: arr[0]!.cityId,
      cityName: arr[0]!.cityName,
      schoolCount: arr.length,
      avgComposite: cN > 0 ? cSum / cN : 0,
      avgTrendDelta: tN > 0 ? tSum / tN : null
    });
  }
  out.sort((a, b) => b.avgComposite - a.avgComposite);
  return out;
}

/**
 * 任一维度 Top N。维度字段值越大学校越突出。
 */
export function getSchoolDimensionByDimensionTopN(
  dimension: SchoolDimensionKey,
  cityId: number | undefined,
  n: number = 5
): SchoolDimensionEntry[] {
  const all = getSchoolDimensions();
  const out: SchoolDimensionEntry[] = [];
  for (const s of all) {
    if (cityId != null && s.cityId !== cityId) continue;
    const v = s[dimension];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out.push({
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      cityId: s.cityId,
      cityName: s.cityName,
      districtName: s.districtName,
      schoolType: s.schoolType,
      score: v,
      trendDelta: s.trendDelta,
      isGroup: s.isGroup,
      compositeScore: s.compositeScore
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, n);
}

/**
 * "六边形战士"：所有 3 个核心维度都达阈值的学校（默认 80）。
 * 阈值可调，便于切换"严选"vs"宽松"。
 */
export interface PolymathConfig {
  levelScoreMin?: number;
  groupStrengthMin?: number;
  districtBalanceMin?: number;
}

export function getSchoolDimensionPolymath(
  cityId: number | undefined,
  cfg: PolymathConfig = {}
): SchoolDimensionEntry[] {
  const ls = cfg.levelScoreMin ?? 80;
  const gs = cfg.groupStrengthMin ?? 70;
  const db = cfg.districtBalanceMin ?? 70;
  const all = getSchoolDimensions();
  const out: SchoolDimensionEntry[] = [];
  for (const s of all) {
    if (cityId != null && s.cityId !== cityId) continue;
    if (
      s.levelScore < ls ||
      s.groupStrength < gs ||
      s.districtBalance < db
    )
      continue;
    // 用 compositeScore 代替单一 score
    out.push({
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      cityId: s.cityId,
      cityName: s.cityName,
      districtName: s.districtName,
      schoolType: s.schoolType,
      score: s.compositeScore,
      trendDelta: s.trendDelta,
      isGroup: s.isGroup,
      compositeScore: s.compositeScore
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export interface CityTopComposite {
  cityId: number;
  cityName: string;
  topSchool: SchoolDimensionEntry | null;
}

/**
 * 每个城市综合得分最高的学校（compositeScore）。
 */
export function getCityByCompositeRank(): CityTopComposite[] {
  const all = getSchoolDimensions();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalSchoolDimension[]>();
  for (const s of all) {
    let arr = grouped.get(s.cityId);
    if (!arr) {
      arr = [];
      grouped.set(s.cityId, arr);
    }
    arr.push(s);
  }
  const out: CityTopComposite[] = [];
  for (const arr of grouped.values()) {
    let best: LocalSchoolDimension | null = null;
    for (const s of arr) {
      if (!best || s.compositeScore > best.compositeScore) {
        best = s;
      }
    }
    if (!best) continue;
    out.push({
      cityId: best.cityId,
      cityName: best.cityName,
      topSchool: {
        schoolId: best.schoolId,
        schoolName: best.schoolName,
        cityId: best.cityId,
        cityName: best.cityName,
        districtName: best.districtName,
        schoolType: best.schoolType,
        score: best.compositeScore,
        trendDelta: best.trendDelta,
        isGroup: best.isGroup,
        compositeScore: best.compositeScore
      }
    });
  }
  out.sort((a, b) => (b.topSchool?.score ?? 0) - (a.topSchool?.score ?? 0));
  return out;
}
