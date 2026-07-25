/**
 * v1.109.0 派生：社区总价×单价散点（v0.45 既有数据源）。
 *
 * 输入：snapshot.communityScatter（LocalCommunityScatter[]，18 行 × 三城）。
 * 每社区一行：含 medianUnitPrice / medianTotalPrice10w / medianArea / areaCohort / quadrant。
 * areaCohort: "小户型(<60)" / "改善(60-110)" / "大户型(>110)"
 * quadrant: "豪宅板块" / "学区刚需" / "改善低密" / "价值洼地"
 *
 * 派生：
 *   - summarizeCommunityScatterByCity: city 聚合（小区数 / 4 象限分布 / 3 面积段分布 / 平均单价）
 *   - summarizeCommunityScatterByCityQuadrant: city × quadrant 聚合
 *   - summarizeCommunityScatterByCityAreaCohort: city × areaCohort 聚合
 *   - getCommunityScatterByQuadrant: 某象限所有 community（按 city 过滤可选）
 *   - getCommunityScatterByAreaCohort: 某面积段所有 community
 *   - getCommunityScatterPareto: "改善 cohort + 单价 ≤ X" 找性价比改善房
 *   - getCommunityScatterCrossCityByQuadrant: 跨城对比某象限的"代表性社区"
 *   - getCommunityScatterByCityTotalPriceExtremes: 单 city 总价榜 Top/Bottom N（"千万豪宅"vs"上车盘"）
 */

import { getCommunityScatter } from "./store";
import type { LocalCommunityScatter } from "./types";

export interface CityCommunityScatterSummary {
  cityId: number;
  communityCount: number;
  /** 4 象限分布 {quadrant: count} */
  quadrantDistribution: Record<string, number>;
  /** 3 面积段分布 {areaCohort: count} */
  areaCohortDistribution: Record<string, number>;
  avgUnitPrice: number;
  avgTotalPrice10w: number;
  avgArea: number;
}

export function summarizeCommunityScatterByCity(): CityCommunityScatterSummary[] {
  const all = getCommunityScatter();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommunityScatter[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityCommunityScatterSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const quadrant: Record<string, number> = {};
    const area: Record<string, number> = {};
    for (const x of arr) {
      quadrant[x.quadrant] = (quadrant[x.quadrant] ?? 0) + 1;
      area[x.areaCohort] = (area[x.areaCohort] ?? 0) + 1;
    }
    out.push({
      cityId,
      communityCount: arr.length,
      quadrantDistribution: quadrant,
      areaCohortDistribution: area,
      avgUnitPrice:
        arr.reduce((s, x) => s + x.medianUnitPrice, 0) / arr.length,
      avgTotalPrice10w:
        arr.reduce((s, x) => s + x.medianTotalPrice10w, 0) / arr.length,
      avgArea: arr.reduce((s, x) => s + x.medianArea, 0) / arr.length
    });
  }
  out.sort((a, b) => b.avgUnitPrice - a.avgUnitPrice);
  return out;
}

export interface QuadrantSummary {
  cityId: number;
  quadrant: string;
  communityCount: number;
  avgUnitPrice: number;
}

export function summarizeCommunityScatterByCityQuadrant(): QuadrantSummary[] {
  const all = getCommunityScatter();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalCommunityScatter[]>();
  for (const x of all) {
    const key = `${x.cityId}|${x.quadrant}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(x);
  }
  const out: QuadrantSummary[] = [];
  for (const [, arr] of grouped.entries()) {
    out.push({
      cityId: arr[0]!.cityId,
      quadrant: arr[0]!.quadrant,
      communityCount: arr.length,
      avgUnitPrice:
        arr.reduce((s, x) => s + x.medianUnitPrice, 0) / arr.length
    });
  }
  out.sort((a, b) => b.avgUnitPrice - a.avgUnitPrice);
  return out;
}

export interface AreaCohortSummary {
  cityId: number;
  areaCohort: string;
  communityCount: number;
  avgUnitPrice: number;
  avgTotalPrice10w: number;
  avgArea: number;
}

export function summarizeCommunityScatterByCityAreaCohort(): AreaCohortSummary[] {
  const all = getCommunityScatter();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalCommunityScatter[]>();
  for (const x of all) {
    const key = `${x.cityId}|${x.areaCohort}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(x);
  }
  const out: AreaCohortSummary[] = [];
  for (const [, arr] of grouped.entries()) {
    out.push({
      cityId: arr[0]!.cityId,
      areaCohort: arr[0]!.areaCohort,
      communityCount: arr.length,
      avgUnitPrice:
        arr.reduce((s, x) => s + x.medianUnitPrice, 0) / arr.length,
      avgTotalPrice10w:
        arr.reduce((s, x) => s + x.medianTotalPrice10w, 0) / arr.length,
      avgArea: arr.reduce((s, x) => s + x.medianArea, 0) / arr.length
    });
  }
  out.sort((a, b) => b.avgUnitPrice - a.avgUnitPrice);
  return out;
}

/** 某象限全部 community */
export function getCommunityScatterByQuadrant(
  quadrant: string,
  cityId: number | null = null
): LocalCommunityScatter[] {
  const all = getCommunityScatter().filter((x) => x.quadrant === quadrant);
  if (cityId == null) return all;
  return all.filter((x) => x.cityId === cityId);
}

/** 某面积段全部 community */
export function getCommunityScatterByAreaCohort(
  areaCohort: string,
  cityId: number | null = null
): LocalCommunityScatter[] {
  const all = getCommunityScatter().filter((x) => x.areaCohort === areaCohort);
  if (cityId == null) return all;
  return all.filter((x) => x.cityId === cityId);
}

/** "改善 cohort + 单价 ≤ X" 性价比改善房 */
export interface ParetoEntry {
  communityId: number;
  cityName: string;
  communityName: string;
  medianUnitPrice: number;
  medianArea: number;
  areaCohort: string;
  quadrant: string;
}

export function getCommunityScatterPareto(
  areaCohort: string,
  maxUnitPrice: number,
  n: number = 5
): ParetoEntry[] {
  const all = getCommunityScatter().filter(
    (x) =>
      x.areaCohort === areaCohort && x.medianUnitPrice <= maxUnitPrice
  );
  return [...all]
    .sort((a, b) => b.medianArea - a.medianArea) // 大面积优先（改善房逻辑）
    .slice(0, n)
    .map((c) => ({
      communityId: c.communityId,
      cityName: c.cityName,
      communityName: c.communityName,
      medianUnitPrice: c.medianUnitPrice,
      medianArea: c.medianArea,
      areaCohort: c.areaCohort,
      quadrant: c.quadrant
    }));
}

/** 跨城某象限的代表 community（取每个 city 单价最高的 1 个） */
export interface CrossCityQuadrantEntry {
  cityId: number;
  cityName: string;
  quadrant: string;
  communityName: string;
  medianUnitPrice: number;
  medianTotalPrice10w: number;
}

export function getCommunityScatterCrossCityByQuadrant(
  quadrant: string
): CrossCityQuadrantEntry[] {
  const all = getCommunityScatter().filter((x) => x.quadrant === quadrant);
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommunityScatter>();
  for (const x of all) {
    const cur = grouped.get(x.cityId);
    if (!cur || x.medianUnitPrice > cur.medianUnitPrice) {
      grouped.set(x.cityId, x);
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.medianUnitPrice - a.medianUnitPrice)
    .map((c) => ({
      cityId: c.cityId,
      cityName: c.cityName,
      quadrant: c.quadrant,
      communityName: c.communityName,
      medianUnitPrice: c.medianUnitPrice,
      medianTotalPrice10w: c.medianTotalPrice10w
    }));
}

/** 单 city 总价 Top / Bottom N（"千万豪宅" vs "上车盘"） */
export interface TotalPriceExtreme {
  communityId: number;
  communityName: string;
  medianTotalPrice10w: number;
  medianUnitPrice: number;
  medianArea: number;
}

export function getCommunityScatterByCityTotalPriceExtremes(
  cityId: number | null = null,
  n: number = 5
): { top: TotalPriceExtreme[]; bottom: TotalPriceExtreme[] } {
  const all = getCommunityScatter();
  if (all.length === 0) return { top: [], bottom: [] };
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  if (pool.length === 0) return { top: [], bottom: [] };
  const sortedDesc = [...pool].sort(
    (a, b) => b.medianTotalPrice10w - a.medianTotalPrice10w
  );
  const sortedAsc = [...pool].sort(
    (a, b) => a.medianTotalPrice10w - b.medianTotalPrice10w
  );
  const map = (x: LocalCommunityScatter): TotalPriceExtreme => ({
    communityId: x.communityId,
    communityName: x.communityName,
    medianTotalPrice10w: x.medianTotalPrice10w,
    medianUnitPrice: x.medianUnitPrice,
    medianArea: x.medianArea
  });
  return {
    top: sortedDesc.slice(0, n).map(map),
    bottom: sortedAsc.slice(0, n).map(map)
  };
}