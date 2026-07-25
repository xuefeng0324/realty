/**
 * v1.106.0 派生：朝向 × 楼层 溢价（v0.43 既有数据源）。
 *
 * 输入：snapshot.orientationFloor（LocalOrientationFloor[]，48 行）。
 * 每行 = (cityId, cityName, orientation, floorBucket, count, share, medianUnitPrice, premiumPct)。
 * 4 朝向 × 4 楼层 = 16 组合 / 城 × 3 城 = 48 行。
 *
 * 派生：
 *   - summarizeOrientationFloorByCity: city 聚合（listing 数 / 平均 premium / 朝向/楼层平均）
 *   - getOrientationFloorByCityOrientation: 单 city 单朝向 4 楼层溢价对比
 *   - getOrientationFloorByCityFloorBucket: 单 city 单楼层 4 朝向溢价对比
 *   - getOrientationFloorCrossCityByPair: 跨城对比某 (orientation, floor) 组合溢价
 *   - getOrientationFloorBestWorstByCity: 每城溢价最高 vs 折价最深 Top N
 *   - getOrientationFloorByOrientationLeaderboard: 全 (city, floor) 中"某朝向"最贵 Top N
 */

import { getOrientationFloor } from "./store";
import type { LocalOrientationFloor } from "./types";

export interface CityOrientationFloorSummary {
  cityId: number;
  cityName: string;
  rowCount: number;
  totalListings: number;
  avgPremiumPct: number;
  /** 该城溢价最高的 (orientation, floor) 组合 */
  best: LocalOrientationFloor | null;
  /** 该城折价最深的 (orientation, floor) 组合 */
  worst: LocalOrientationFloor | null;
}

export function summarizeOrientationFloorByCity(): CityOrientationFloorSummary[] {
  const all = getOrientationFloor();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalOrientationFloor[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityOrientationFloorSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const sorted = [...arr].sort((a, b) => b.premiumPct - a.premiumPct);
    out.push({
      cityId,
      cityName: arr[0]!.cityName,
      rowCount: arr.length,
      totalListings: arr.reduce((s, x) => s + x.count, 0),
      avgPremiumPct:
        arr.reduce((s, x) => s + x.premiumPct, 0) / arr.length,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null
    });
  }
  out.sort((a, b) => b.avgPremiumPct - a.avgPremiumPct);
  return out;
}

/** 单 city 单朝向 4 楼层溢价对比 */
export function getOrientationFloorByCityOrientation(
  cityId: number,
  orientation: string
): LocalOrientationFloor[] {
  const all = getOrientationFloor().filter(
    (x) => x.cityId === cityId && x.orientation === orientation
  );
  if (all.length === 0) return [];
  return [...all].sort((a, b) => b.premiumPct - a.premiumPct);
}

/** 单 city 单楼层 4 朝向溢价对比 */
export function getOrientationFloorByCityFloorBucket(
  cityId: number,
  floorBucket: string
): LocalOrientationFloor[] {
  const all = getOrientationFloor().filter(
    (x) => x.cityId === cityId && x.floorBucket === floorBucket
  );
  if (all.length === 0) return [];
  return [...all].sort((a, b) => b.premiumPct - a.premiumPct);
}

/**
 * 跨城对比某 (orientation, floor) 组合的溢价
 * 例：getOrientationFloorCrossCityByPair("南北通透", "顶层") 看 3 城顶层南北通透溢价差距
 */
export interface CrossCityOrientationFloorEntry {
  cityId: number;
  cityName: string;
  orientation: string;
  floorBucket: string;
  count: number;
  share: number;
  medianUnitPrice: number;
  premiumPct: number;
}

export function getOrientationFloorCrossCityByPair(
  orientation: string,
  floorBucket: string
): CrossCityOrientationFloorEntry[] {
  const all = getOrientationFloor().filter(
    (x) => x.orientation === orientation && x.floorBucket === floorBucket
  );
  return [...all].sort((a, b) => b.premiumPct - a.premiumPct);
}

/** 每城溢价最高 / 折价最深 Top N（n = 每城取几个；返回数组长度 = 城数 × n） */
export interface CityOrientationFloorTopEntry {
  cityId: number;
  cityName: string;
  orientation: string;
  floorBucket: string;
  premiumPct: number;
  medianUnitPrice: number;
}

export function getOrientationFloorBestWorstByCity(
  n: number = 3
): { best: CityOrientationFloorTopEntry[]; worst: CityOrientationFloorTopEntry[] } {
  const all = getOrientationFloor();
  if (all.length === 0) return { best: [], worst: [] };

  // 按 city 分组
  const grouped = new Map<number, LocalOrientationFloor[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const best: CityOrientationFloorTopEntry[] = [];
  const worst: CityOrientationFloorTopEntry[] = [];
  for (const [, arr] of grouped.entries()) {
    const sorted = [...arr].sort((a, b) => b.premiumPct - a.premiumPct);
    for (let i = 0; i < n && i < sorted.length; i++) {
      const x = sorted[i]!;
      best.push({
        cityId: x.cityId,
        cityName: x.cityName,
        orientation: x.orientation,
        floorBucket: x.floorBucket,
        premiumPct: x.premiumPct,
        medianUnitPrice: x.medianUnitPrice
      });
    }
    const reversed = [...arr].sort((a, b) => a.premiumPct - b.premiumPct);
    for (let i = 0; i < n && i < reversed.length; i++) {
      const x = reversed[i]!;
      worst.push({
        cityId: x.cityId,
        cityName: x.cityName,
        orientation: x.orientation,
        floorBucket: x.floorBucket,
        premiumPct: x.premiumPct,
        medianUnitPrice: x.medianUnitPrice
      });
    }
  }
  best.sort((a, b) => b.premiumPct - a.premiumPct);
  worst.sort((a, b) => a.premiumPct - b.premiumPct);
  // 不再 slice：n 是"每城取几个"，调用方需要时自行 slice
  return { best, worst };
}

/** 全 (city, floor) 中"某朝向"最贵 Top N（按 medianUnitPrice 倒序） */
export function getOrientationFloorByOrientationLeaderboard(
  orientation: string,
  n: number = 5
): LocalOrientationFloor[] {
  const all = getOrientationFloor().filter(
    (x) => x.orientation === orientation
  );
  if (all.length === 0) return [];
  return [...all]
    .sort((a, b) => b.medianUnitPrice - a.medianUnitPrice)
    .slice(0, n);
}