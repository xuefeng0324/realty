/**
 * v0.98.0 派生：周边菜市场/超市覆盖指标。
 *
 * 输入：snapshot.poiMarkets（LocalPoiMarket[]，共 137 行，每小区前 3 个最近市场 POI）。
 *
 * 派生指标：
 *   - summarizePoiMarketByCommunity: 小区聚合（最近距离 / 最远距离 / market 数）
 *   - getPoiMarketNearestByCommunity: 指定小区的最近市场（含名称 + 距离 + 类别）
 *   - getPoiMarketDistanceLeaderboard: "最近 N 个 / 最远 N 个"小区榜
 *   - getPoiMarketByCategoryRanking: 按"菜市场 vs 综合超市"分类的覆盖分布
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getPoiMarkets } from "./store";
import type { LocalPoiMarket } from "./types";

export interface CommunityPoiMarketSummary {
  communityId: number;
  marketCount: number;
  /** 最近距离 */
  nearestDistanceM: number | null;
  /** 第 N 名（默认 rank=3）的距离 */
  farthestDistanceM: number | null;
  /** 最近 market 名（rank=1） */
  nearestName: string | null;
  /** 该小区在本批 community 中的中心位置（lat/lng 中位，仅供参考） */
  medianLat: number | null;
  medianLng: number | null;
}

export function summarizePoiMarketByCommunity(): CommunityPoiMarketSummary[] {
  const all = getPoiMarkets();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalPoiMarket[]>();
  for (const p of all) {
    let arr = grouped.get(p.communityId);
    if (!arr) {
      arr = [];
      grouped.set(p.communityId, arr);
    }
    arr.push(p);
  }
  const out: CommunityPoiMarketSummary[] = [];
  for (const [cid, arr] of grouped.entries()) {
    arr.sort((a, b) => a.rank - b.rank);
    const nearest = arr[0]?.distanceM ?? null;
    const farthest = arr[arr.length - 1]?.distanceM ?? null;
    const lats: number[] = [];
    const lngs: number[] = [];
    for (const p of arr) {
      if (p.lat != null) lats.push(p.lat);
      if (p.lng != null) lngs.push(p.lng);
    }
    out.push({
      communityId: cid,
      marketCount: arr.length,
      nearestDistanceM: nearest,
      farthestDistanceM: farthest,
      nearestName: arr[0]?.poiName ?? null,
      medianLat: lats.length > 0 ? median(lats) : null,
      medianLng: lngs.length > 0 ? median(lngs) : null
    });
  }
  out.sort((a, b) => a.communityId - b.communityId);
  return out;
}

export interface NearestMarketEntry {
  communityId: number;
  poiName: string;
  poiTypeCategory: string;
  distanceM: number;
  address: string;
}

export function getPoiMarketNearestByCommunity(
  communityId: number
): NearestMarketEntry | null {
  const arr = (getPoiMarkets() ?? []).filter(
    (p) => p.communityId === communityId && p.rank === 1
  );
  if (arr.length === 0) {
    // 没有 rank=1 时回退拿该小区距离最近的一个
    const all = (getPoiMarkets() ?? [])
      .filter((p) => p.communityId === communityId)
      .sort((a, b) => a.distanceM - b.distanceM);
    if (all.length === 0) return null;
    const p = all[0]!;
    return {
      communityId: p.communityId,
      poiName: p.poiName,
      poiTypeCategory: p.poiTypeCategory,
      distanceM: p.distanceM,
      address: p.address
    };
  }
  const p = arr[0]!;
  return {
    communityId: p.communityId,
    poiName: p.poiName,
    poiTypeCategory: p.poiTypeCategory,
    distanceM: p.distanceM,
    address: p.address
  };
}

/** "最近 N 个 / 最远 N 个"小区榜 */
export interface CommunityDistanceRanking {
  nearest: CommunityPoiMarketSummary[];
  farthest: CommunityPoiMarketSummary[];
}

export function getPoiMarketDistanceLeaderboard(
  n: number = 5
): CommunityDistanceRanking {
  const summaries = summarizePoiMarketByCommunity();
  const withDistance = summaries.filter((s) => s.nearestDistanceM != null);
  const nearest = [...withDistance]
    .sort((a, b) => (a.nearestDistanceM ?? 0) - (b.nearestDistanceM ?? 0))
    .slice(0, n);
  const farthest = [...withDistance]
    .sort((a, b) => (b.nearestDistanceM ?? 0) - (a.nearestDistanceM ?? 0))
    .slice(0, n);
  return { nearest, farthest };
}

/** 按"菜市场"类别（> = '菜市场' / '农贸市场' / '综合市场' 等）统计 */
export interface MarketCategoryStat {
  /** 类别名（精确） */
  category: string;
  count: number;
  /** 该类别下平均距离 */
  avgDistanceM: number;
}

export function getPoiMarketByCategoryRanking(): MarketCategoryStat[] {
  const all = getPoiMarkets();
  if (all.length === 0) return [];
  const grouped = new Map<string, number[]>();
  for (const p of all) {
    const arr = grouped.get(p.poiTypeCategory) ?? [];
    arr.push(p.distanceM);
    grouped.set(p.poiTypeCategory, arr);
  }
  const out: MarketCategoryStat[] = [];
  for (const [cat, dists] of grouped.entries()) {
    out.push({
      category: cat,
      count: dists.length,
      avgDistanceM:
        dists.length > 0 ? dists.reduce((s, x) => s + x, 0) / dists.length : 0
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}
