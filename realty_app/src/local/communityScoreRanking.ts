/**
 * v0.99.0 派生：小区综合得分指标。
 *
 * 输入：snapshot.communityScores（49 行，每小区一行 4 维评分 + city 内排名）。
 *
 * 派生：
 *   - summarizeCommunityScoreByCity: 按城市聚合（小区数 / 各维度均值 / 总均分）
 *   - getCommunityScoreByTotalTopN: 按 total_score 取全市 Top N（无城市过滤时是跨城总榜）
 *   - getCommunityScoreByDimensionTopN: 按 life / school / commute 维度取 Top N
 *   - getCommunityScoreByCommuteFastest: 按通勤分钟升序 Top N（commute_minutes）
 *   - getCommunityScoreByCommuteScoreFastest: 按 commute_score 降序（最快通勤）
 *   - getCommunityScorePareto: 在 total ≥ X 的小区中找出 commuteMinutes 最小的前 N（综合优 + 通勤快 Pareto）
 */

import { getCommunityScores } from "./store";
import type { LocalCommunityScore } from "./types";

export type Dimension = "life" | "school" | "commute";

export interface CommunityScoreCitySummary {
  cityId: number;
  communityCount: number;
  avgLifeScore: number;
  avgSchoolScore: number;
  avgCommuteScore: number;
  avgCommuteMinutes: number;
  avgTotalScore: number;
}

export function summarizeCommunityScoreByCity(): CommunityScoreCitySummary[] {
  const all = getCommunityScores();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommunityScore[]>();
  for (const s of all) {
    let arr = grouped.get(s.cityId);
    if (!arr) {
      arr = [];
      grouped.set(s.cityId, arr);
    }
    arr.push(s);
  }
  const out: CommunityScoreCitySummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const n = arr.length;
    const avg = (xs: number[]) =>
      xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
    out.push({
      cityId,
      communityCount: n,
      avgLifeScore: avg(arr.map((s) => s.lifeScore)),
      avgSchoolScore: avg(arr.map((s) => s.schoolScore)),
      avgCommuteScore: avg(arr.map((s) => s.commuteScore)),
      avgCommuteMinutes: safeAvg(arr.map((s) => s.commuteMinutes)),
      avgTotalScore: avg(arr.map((s) => s.totalScore))
    });
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

function safeAvg(xs: (number | null)[]): number {
  const valid = xs.filter((x): x is number => x != null);
  return valid.length > 0 ? valid.reduce((s, x) => s + x, 0) / valid.length : 0;
}

function dimValue(s: LocalCommunityScore, dim: Dimension): number {
  if (dim === "life") return s.lifeScore;
  if (dim === "school") return s.schoolScore;
  return s.commuteScore;
}

/** 跨城或按 city 总榜 */
export function getCommunityScoreByTotalTopN(
  cityId: number | null,
  n: number = 5
): LocalCommunityScore[] {
  const all = getCommunityScores();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((s) => s.cityId === cityId);
  pool.sort((a, b) => b.totalScore - a.totalScore);
  return pool.slice(0, n);
}

/** 按 life/school/commute 维度 Top N */
export function getCommunityScoreByDimensionTopN(
  dim: Dimension,
  cityId: number | null,
  n: number = 5
): LocalCommunityScore[] {
  const all = getCommunityScores();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((s) => s.cityId === cityId);
  pool.sort((a, b) => dimValue(b, dim) - dimValue(a, dim));
  return pool.slice(0, n);
}

/** 通勤最快（commuteMinutes 升序） */
export function getCommunityScoreByCommuteFastest(
  cityId: number | null,
  n: number = 5
): LocalCommunityScore[] {
  const all = getCommunityScores();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((s) => s.cityId === cityId);
  pool.sort((a, b) => {
    const am = a.commuteMinutes ?? Number.POSITIVE_INFINITY;
    const bm = b.commuteMinutes ?? Number.POSITIVE_INFINITY;
    return am - bm;
  });
  return pool.slice(0, n);
}

/**
 * 综合 Pareto：在 total_score ≥ minTotal 的小区里，找 commuteMinutes 最小的前 N。
 * 用于给"住得方便 + 通勤快"找平衡点。
 */
export function getCommunityScorePareto(
  cityId: number | null,
  minTotal: number = 80,
  n: number = 5
): LocalCommunityScore[] {
  const all = getCommunityScores();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((s) => s.cityId === cityId);
  const filtered = pool.filter((s) => s.totalScore >= minTotal);
  filtered.sort((a, b) => {
    const am = a.commuteMinutes ?? Number.POSITIVE_INFINITY;
    const bm = b.commuteMinutes ?? Number.POSITIVE_INFINITY;
    return am - bm;
  });
  return filtered.slice(0, n);
}