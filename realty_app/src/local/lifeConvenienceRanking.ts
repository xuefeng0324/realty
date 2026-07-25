/**
 * v1.105.0 派生：生活便利度（v0.31 既有数据源）。
 *
 * 输入：snapshot.lifeConveniences（LocalLifeConvenience[]，44 行）。
 * 6 维度 POI 便利分（mall/park/subway/school/hospital/market）加权 → score ∈ [0, 110]，score100 ∈ [0, 100]。
 *
 * 派生：
 *   - summarizeLifeConvenienceByCity: city 聚合（小区数 / 各 POI 平均近数 / 平均 score100）
 *   - getLifeConvenienceTopByScore: 全市/单城 score100 Top N
 *   - getLifeConvenienceByCityDistrict: 区分聚合 + rankOverall
 *   - getLifeConvenienceByDimensionCoverage: 全量按维度"近数"倒序 Top N（看哪个维度差距最大）
 *   - getLifeConveniencePareto: "score100 ≥ X" + "subwayNear 最多" Pareto 榜（地铁便利 + 综合便利）
 *   - getLifeConvenienceDimensionBalance: 检测"单维度极强但综合分低"的失衡小区（伪便利）
 */

import { getLifeConveniences } from "./store";
import type { LocalLifeConvenience } from "./types";

export type ConvenienceDimension =
  | "mallNear"
  | "parkNear"
  | "subwayNear"
  | "schoolNear"
  | "hospitalNear"
  | "marketNear";

export interface CityLifeConvenienceSummary {
  cityId: number;
  communityCount: number;
  avgMallNear: number;
  avgParkNear: number;
  avgSubwayNear: number;
  avgSchoolNear: number;
  avgHospitalNear: number;
  avgMarketNear: number;
  /** 平均 score100 */
  avgScore100: number;
  /** 该 city 最高分小区 */
  top: LocalLifeConvenience | null;
}

export function summarizeLifeConvenienceByCity(): CityLifeConvenienceSummary[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalLifeConvenience[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityLifeConvenienceSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const avg = (key: ConvenienceDimension) =>
      arr.reduce((s, x) => s + x[key], 0) / arr.length;
    const sorted = [...arr].sort((a, b) => b.score100 - a.score100);
    out.push({
      cityId,
      communityCount: arr.length,
      avgMallNear: avg("mallNear"),
      avgParkNear: avg("parkNear"),
      avgSubwayNear: avg("subwayNear"),
      avgSchoolNear: avg("schoolNear"),
      avgHospitalNear: avg("hospitalNear"),
      avgMarketNear: avg("marketNear"),
      avgScore100:
        arr.reduce((s, x) => s + x.score100, 0) / arr.length,
      top: sorted[0] ?? null
    });
  }
  out.sort((a, b) => b.avgScore100 - a.avgScore100);
  return out;
}

/** 按 score100 取 Top N */
export function getLifeConvenienceTopByScore(
  cityId: number | null,
  n: number = 5
): LocalLifeConvenience[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  return [...pool].sort((a, b) => b.score100 - a.score100).slice(0, n);
}

export interface DistrictLifeConvenienceSummary {
  cityId: number;
  districtName: string;
  communityCount: number;
  avgScore100: number;
  rankOverall: number;
}

export function getLifeConvenienceByCityDistrict(
  cityId?: number
): DistrictLifeConvenienceSummary[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  const grouped = new Map<
    string,
    { cityId: number; districtName: string; arr: LocalLifeConvenience[] }
  >();
  for (const x of pool) {
    const key = `${x.cityId}|${x.districtName}`;
    let cur = grouped.get(key);
    if (!cur) {
      cur = { cityId: x.cityId, districtName: x.districtName, arr: [] };
      grouped.set(key, cur);
    }
    cur.arr.push(x);
  }
  const out: DistrictLifeConvenienceSummary[] = [];
  for (const [, v] of grouped.entries()) {
    out.push({
      cityId: v.cityId,
      districtName: v.districtName,
      communityCount: v.arr.length,
      avgScore100:
        v.arr.reduce((s, x) => s + x.score100, 0) / v.arr.length,
      rankOverall: 0
    });
  }
  out.sort((a, b) => b.avgScore100 - a.avgScore100);
  out.forEach((d, i) => (d.rankOverall = i + 1));
  return out;
}

export interface DimensionCoverageEntry {
  communityId: number;
  cityName: string;
  districtName: string;
  communityName: string;
  dimension: ConvenienceDimension;
  value: number;
}

/** 全量按"维度近数"倒序取 Top N：哪个小区某维度近数最高 */
export function getLifeConvenienceByDimensionCoverage(
  dimension: ConvenienceDimension,
  n: number = 5
): DimensionCoverageEntry[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  return [...all]
    .sort((a, b) => b[dimension] - a[dimension])
    .slice(0, n)
    .map((c) => ({
      communityId: c.communityId,
      cityName: c.communityName, // 注意：lifeConvenience 没 cityName 字段
      districtName: c.districtName,
      communityName: c.communityName,
      dimension,
      value: c[dimension]
    }));
}

/** "综合 ≥ X + 某维度最强" Pareto 榜 */
export interface ParetoEntry {
  communityId: number;
  districtName: string;
  communityName: string;
  score100: number;
  dimValue: number;
}

export function getLifeConveniencePareto(
  dimension: ConvenienceDimension,
  minScore100: number = 80,
  n: number = 5
): ParetoEntry[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  return [...all]
    .filter((x) => x.score100 >= minScore100)
    .sort((a, b) => b[dimension] - a[dimension])
    .slice(0, n)
    .map((c) => ({
      communityId: c.communityId,
      districtName: c.districtName,
      communityName: c.communityName,
      score100: c.score100,
      dimValue: c[dimension]
    }));
}

/** 单维度极强但综合分低 → 失衡小区（"伪便利"） */
export interface DimensionImbalance {
  communityId: number;
  districtName: string;
  communityName: string;
  score100: number;
  strongestDim: ConvenienceDimension;
  strongestValue: number;
  /** 综合分 < threshold 且 strongestValue > dimThreshold */
  reason: "score低维强";
}

export function getLifeConvenienceDimensionBalance(
  score100Threshold: number = 60,
  dimThreshold: number = 25,
  n: number = 5
): DimensionImbalance[] {
  const all = getLifeConveniences();
  if (all.length === 0) return [];
  const dims: ConvenienceDimension[] = [
    "mallNear",
    "parkNear",
    "subwayNear",
    "schoolNear",
    "hospitalNear",
    "marketNear"
  ];
  const out: DimensionImbalance[] = [];
  for (const c of all) {
    if (c.score100 >= score100Threshold) continue;
    let strongestDim: ConvenienceDimension = dims[0]!;
    let strongestValue = c[strongestDim];
    for (const d of dims) {
      if (c[d] > strongestValue) {
        strongestValue = c[d];
        strongestDim = d;
      }
    }
    if (strongestValue > dimThreshold) {
      out.push({
        communityId: c.communityId,
        districtName: c.districtName,
        communityName: c.communityName,
        score100: c.score100,
        strongestDim,
        strongestValue,
        reason: "score低维强"
      });
    }
  }
  out.sort((a, b) => b.strongestValue - a.strongestValue);
  return out.slice(0, n);
}