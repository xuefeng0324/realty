/**
 * v1.104.0 派生：通勤时长排行。
 *
 * 输入：snapshot.commutes（LocalCommute[]，32 行）。
 * 每行代表某 community → 某 city CBD 的"第一方案"通勤数据。
 * transitMinutes / transitDistanceM 都可能 null（API 失败）。
 *
 * 派生：
 *   - summarizeCommuteByCity: 按 city 聚合（小区数 / 平均分钟 [null 安全] / 平均距离 [null 安全] / 速度 km/h）
 *   - getCommuteFastestTopN: 按 transitMinutes 升序取 Top N（null 末尾）
 *   - getCommuteByCityFastest: 按 cityId 取该城市最快小区榜
 *   - getCommuteSpeedLeaderboard: 按"距离 / 时间"算速度（km/h），取速度最快 Top N
 *   - getCommuteByCityFastestSlowestCompare: 城市内最快 vs 最慢 5 倍差距
 */

import { getCommutes } from "./store";
import type { LocalCommute } from "./types";

export interface CityCommuteSummary {
  cityId: number;
  cityName: string;
  communityCount: number;
  /** 平均通勤分钟（null 跳过） */
  avgMinutes: number | null;
  /** 平均通勤距离 米（null 跳过） */
  avgDistanceM: number | null;
  /** 平均速度 km/h = avgDistanceM(km) / avgMinutes(h)（任一为 null 则 null） */
  avgSpeedKmh: number | null;
  /** 该 city 最快的 community */
  fastest: LocalCommute | null;
  /** 该 city 最慢的 community */
  slowest: LocalCommute | null;
}

function safeAvg(xs: (number | null)[]): number | null {
  const valid = xs.filter((x): x is number => x != null);
  return valid.length > 0
    ? valid.reduce((s, x) => s + x, 0) / valid.length
    : null;
}

export function summarizeCommuteByCity(): CityCommuteSummary[] {
  const all = getCommutes();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommute[]>();
  for (const c of all) {
    let arr = grouped.get(c.cityId);
    if (!arr) {
      arr = [];
      grouped.set(c.cityId, arr);
    }
    arr.push(c);
  }
  const out: CityCommuteSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const valid = arr.filter(
      (c) => c.transitMinutes != null && c.transitDistanceM != null
    );
    const avgMin = safeAvg(arr.map((x) => x.transitMinutes));
    const avgDist = safeAvg(arr.map((x) => x.transitDistanceM));
    // 速度 = avg distance (km) / avg minutes (h)
    let avgSpeed: number | null = null;
    if (avgMin != null && avgDist != null && avgMin > 0) {
      avgSpeed = avgDist / 1000 / (avgMin / 60);
    }
    const sorted = valid.sort(
      (a, b) => (a.transitMinutes ?? 0) - (b.transitMinutes ?? 0)
    );
    out.push({
      cityId,
      cityName: arr[0]!.cityName,
      communityCount: arr.length,
      avgMinutes: avgMin,
      avgDistanceM: avgDist,
      avgSpeedKmh: avgSpeed,
      fastest: sorted[0] ?? null,
      slowest: sorted[sorted.length - 1] ?? null
    });
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

/** 跨城最快 Top N（null 末尾） */
export function getCommuteFastestTopN(
  cityId: number | null,
  n: number = 5
): LocalCommute[] {
  const all = getCommutes();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((c) => c.cityId === cityId);
  return [...pool]
    .sort((a, b) => {
      const am = a.transitMinutes ?? Number.POSITIVE_INFINITY;
      const bm = b.transitMinutes ?? Number.POSITIVE_INFINITY;
      return am - bm;
    })
    .slice(0, n);
}

export interface SpeedEntry {
  communityId: number;
  cityName: string;
  transitMinutes: number;
  transitDistanceM: number;
  speedKmh: number;
}

/** 速度最快 Top N（speed = km / h） */
export function getCommuteSpeedLeaderboard(
  cityId: number | null,
  n: number = 5
): SpeedEntry[] {
  const all = getCommutes();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((c) => c.cityId === cityId);
  const withSpeed: SpeedEntry[] = [];
  for (const c of pool) {
    if (c.transitMinutes == null || c.transitDistanceM == null) continue;
    if (c.transitMinutes <= 0) continue;
    const speed = c.transitDistanceM / 1000 / (c.transitMinutes / 60);
    withSpeed.push({
      communityId: c.communityId,
      cityName: c.cityName,
      transitMinutes: c.transitMinutes,
      transitDistanceM: c.transitDistanceM,
      speedKmh: speed
    });
  }
  return withSpeed.sort((a, b) => b.speedKmh - a.speedKmh).slice(0, n);
}

export interface FastestSlowestCompare {
  cityId: number;
  cityName: string;
  fastestMinutes: number;
  slowestMinutes: number;
  /** slow / fast 倍数（越大越分裂） */
  ratio: number;
}

/** 城市内最快 vs 最慢 的"分裂程度" */
export function getCommuteByCityFastestSlowestCompare(): FastestSlowestCompare[] {
  const all = getCommutes();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommute[]>();
  for (const c of all) {
    let arr = grouped.get(c.cityId);
    if (!arr) {
      arr = [];
      grouped.set(c.cityId, arr);
    }
    arr.push(c);
  }
  const out: FastestSlowestCompare[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const valid = arr.filter((c) => c.transitMinutes != null);
    if (valid.length < 2) continue;
    valid.sort((a, b) => (a.transitMinutes ?? 0) - (b.transitMinutes ?? 0));
    const fastest = valid[0]!.transitMinutes as number;
    const slowest = valid[valid.length - 1]!.transitMinutes as number;
    out.push({
      cityId,
      cityName: arr[0]!.cityName,
      fastestMinutes: fastest,
      slowestMinutes: slowest,
      ratio: fastest > 0 ? slowest / fastest : 0
    });
  }
  out.sort((a, b) => b.ratio - a.ratio);
  return out;
}