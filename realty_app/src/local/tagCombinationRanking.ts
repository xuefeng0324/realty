/**
 * v1.100.0 派生：标签两两组合热度。
 *
 * 输入：snapshot.tagCombinations（LocalTagCombination[]，每 (city, tagA, tagB) 一行）。
 * 321 行（v0.40.0 计算结果）。avgUnitPrice 是 null 时表示样本不足以算均价。
 *
 * 派生：
 *   - summarizeTagCombinationByCity: 按 city 聚合（组合数 / 平均 count / 平均 share）
 *   - getTagCombinationPopularByCity: 某 city 按 count 降序取 Top N
 *   - getTagCombinationPremiumByCity: 某 city 按 avgUnitPrice 降序取 Top N（null 排到末尾）
 *   - getTagCombinationCrossCityByTag: 跨城对比"某 tag 是否常与其他 tag 组合"
 *   - getTagCombinationCrossCityMostCommon: 跨城出现次数最多的"标签 pair"
 */

import { getTagCombinations } from "./store";
import type { LocalTagCombination } from "./types";

export interface CityTagCombinationSummary {
  cityId: number;
  cityName: string;
  combinationCount: number;
  totalListings: number;
  avgShare: number;
  avgCount: number;
}

function summarizeCity(arr: LocalTagCombination[]): CityTagCombinationSummary {
  if (arr.length === 0) {
    return {
      cityId: -1,
      cityName: "",
      combinationCount: 0,
      totalListings: 0,
      avgShare: 0,
      avgCount: 0
    };
  }
  const total = arr.reduce((s, x) => s + x.count, 0);
  return {
    cityId: arr[0]!.cityId,
    cityName: arr[0]!.cityName,
    combinationCount: arr.length,
    totalListings: total,
    avgShare:
      arr.reduce((s, x) => s + x.share, 0) / arr.length,
    avgCount: arr.reduce((s, x) => s + x.count, 0) / arr.length
  };
}

export function summarizeTagCombinationByCity(): CityTagCombinationSummary[] {
  const all = getTagCombinations();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalTagCombination[]>();
  for (const c of all) {
    let arr = grouped.get(c.cityId);
    if (!arr) {
      arr = [];
      grouped.set(c.cityId, arr);
    }
    arr.push(c);
  }
  const out: CityTagCombinationSummary[] = [];
  for (const [, arr] of grouped.entries()) {
    out.push(summarizeCity(arr));
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

/** 某 city 按 count 降序取 Top N（最常见的标签组合） */
export function getTagCombinationPopularByCity(
  cityId: number,
  n: number = 5
): LocalTagCombination[] {
  const all = getTagCombinations().filter((c) => c.cityId === cityId);
  if (all.length === 0) return [];
  return [...all].sort((a, b) => b.count - a.count).slice(0, n);
}

/** 某 city 按 avgUnitPrice 降序取 Top N（null 排到末尾） */
export function getTagCombinationPremiumByCity(
  cityId: number,
  n: number = 5
): LocalTagCombination[] {
  const all = getTagCombinations().filter((c) => c.cityId === cityId);
  if (all.length === 0) return [];
  return [...all]
    .sort((a, b) => {
      const av = a.avgUnitPrice ?? -Infinity;
      const bv = b.avgUnitPrice ?? -Infinity;
      return bv - av;
    })
    .slice(0, n);
}

/** 跨城出现次数最多的"标签 pair"（用 sorted (tagA,tagB) 作 key） */
export interface TagPairAggregate {
  tagA: string;
  tagB: string;
  /** 在 N 个不同城市都出现 */
  cities: string[];
  totalCount: number;
  totalShare: number;
}

export function getTagCombinationCrossCityMostCommon(
  n: number = 5
): TagPairAggregate[] {
  const all = getTagCombinations();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalTagCombination[]>();
  for (const c of all) {
    const a = c.tagA;
    const b = c.tagB;
    const [x, y] =
      a.localeCompare(b, "zh-Hans-CN") <= 0 ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(c);
  }
  const out: TagPairAggregate[] = [];
  for (const [key, arr] of grouped.entries()) {
    if (arr.length < 2) continue; // 至少跨 2 城才有意义
    const [a, b] = key.split("|");
    out.push({
      tagA: a ?? arr[0]!.tagA,
      tagB: b ?? arr[0]!.tagB,
      cities: Array.from(new Set(arr.map((x) => x.cityName))),
      totalCount: arr.reduce((s, x) => s + x.count, 0),
      totalShare: arr.reduce((s, x) => s + x.share, 0)
    });
  }
  out.sort((a, b) => b.totalCount - a.totalCount);
  return out.slice(0, n);
}

/** 跨城对比"某 tag 经常与哪些其他 tag 组合"（按累计 count 排序） */
export interface TagCombinationByTag {
  baseTag: string;
  pairs: Array<{
    otherTag: string;
    cities: number;
    totalCount: number;
  }>;
}

export function getTagCombinationCrossCityByTag(
  baseTag: string,
  n: number = 5
): TagCombinationByTag | null {
  const all = getTagCombinations();
  if (all.length === 0) return null;
  const filtered = all.filter((c) => c.tagA === baseTag || c.tagB === baseTag);
  if (filtered.length === 0) return null;
  const grouped = new Map<string, { count: number; cities: Set<string> }>();
  for (const c of filtered) {
    const other = c.tagA === baseTag ? c.tagB : c.tagA;
    let cur = grouped.get(other);
    if (!cur) {
      cur = { count: 0, cities: new Set() };
      grouped.set(other, cur);
    }
    cur.count += c.count;
    cur.cities.add(c.cityName);
  }
  const pairs = Array.from(grouped.entries())
    .map(([otherTag, v]) => ({
      otherTag,
      cities: v.cities.size,
      totalCount: v.count
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, n);
  return { baseTag, pairs };
}