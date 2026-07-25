/**
 * v0.95.0 派生：挂牌新鲜度市场流动性卡。
 *
 * 输入：snapshot.listingFreshness（LocalListingFreshness[]，共 25 行 / 8 个城市 × 8 个城市），
 * 每行表示某城市某小区的"挂牌新鲜度"：总挂牌数、近 4 周新增数、近 2 周新增数、陈旧数、
 * 综合鲜活度（freshness_score，0–100）、中位挂牌天数（median_age_days）。
 *
 * 派生指标：
 *   - summarizeListingFreshnessByCity: 每城市流动性汇总
 *   - getFreshestCommunityTopN: 最"新鲜"的小区 Top N（高 freshness_score + 低 median_age_days）
 *   - getStalestCommunityTopN: 最"积压"的小区 Top N（低 freshness_score + 高 median_age_days）
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getListingFreshness } from "./store";
import type { LocalListingFreshness } from "./types";

export interface CityFreshnessSummary {
  cityId: number;
  cityName: string;
  /** 城市内的所有小区数 */
  communityCount: number;
  /** 城市总挂牌数 */
  totalListings: number;
  /** 近 4 周新增率（recent4wCount / totalListings，0–1） */
  recent4wRate: number;
  /** 近 2 周新增率（new2wCount / totalListings，0–1） */
  new2wRate: number;
  /** 陈旧挂牌率（staleCount / totalListings，0–1） */
  staleRate: number;
  /** 平均鲜活度（freshness_score 算术均值，0–100） */
  avgFreshness: number;
  /** 平均中位挂牌天数 */
  avgMedianAgeDays: number | null;
}

export function summarizeListingFreshnessByCity(
  cityId?: number
): CityFreshnessSummary[] {
  const all = getListingFreshness();
  if (all.length === 0) return [];

  // 按 cityName 聚合（同一城市多条数据合并）
  const grouped = new Map<number, LocalListingFreshness[]>();
  for (const f of all) {
    if (cityId != null && f.cityId !== cityId) continue;
    let arr = grouped.get(f.cityId);
    if (!arr) {
      arr = [];
      grouped.set(f.cityId, arr);
    }
    arr.push(f);
  }

  const out: CityFreshnessSummary[] = [];
  for (const [cid, arr] of grouped.entries()) {
    const cityName = arr[0]!.cityName;
    let total = 0;
    let r4w = 0;
    let n2w = 0;
    let stale = 0;
    let fScoreSum = 0;
    let medianAgeSum = 0;
    let medianAgeCount = 0;
    for (const f of arr) {
      total += f.totalListings;
      r4w += f.recent4wCount;
      n2w += f.new2wCount;
      stale += f.staleCount;
      fScoreSum += f.freshnessScore;
      if (f.medianAgeDays != null) {
        medianAgeSum += f.medianAgeDays;
        medianAgeCount += 1;
      }
    }
    out.push({
      cityId: cid,
      cityName,
      communityCount: arr.length,
      totalListings: total,
      recent4wRate: total > 0 ? r4w / total : 0,
      new2wRate: total > 0 ? n2w / total : 0,
      staleRate: total > 0 ? stale / total : 0,
      avgFreshness: arr.length > 0 ? fScoreSum / arr.length : 0,
      avgMedianAgeDays: medianAgeCount > 0 ? medianAgeSum / medianAgeCount : null
    });
  }
  // 默认按"鲜活度"降序（最高排前）
  out.sort((a, b) => b.avgFreshness - a.avgFreshness);
  return out;
}

export interface FreshnessRankingEntry {
  communityId: number;
  communityName: string;
  districtName: string;
  cityId: number;
  cityName: string;
  freshnessScore: number;
  medianAgeDays: number | null;
  totalListings: number;
  /** 内部用：score 越低越陈旧 / age 越高越陈旧 */
  stalenessKey: number;
}

/**
 * "最最新鲜"的小区 Top N。
 * 排序：freshnessScore 降序 → medianAgeDays 升序（低龄优先）→ totalListings 降序。
 */
export function getFreshestCommunityTopN(
  cityId: number | undefined,
  n: number = 5
): FreshnessRankingEntry[] {
  const all = getListingFreshness();
  const mapped: FreshnessRankingEntry[] = [];
  for (const f of all) {
    if (cityId != null && f.cityId !== cityId) continue;
    mapped.push({
      communityId: f.communityId,
      communityName: f.communityName,
      districtName: f.districtName,
      cityId: f.cityId,
      cityName: f.cityName,
      freshnessScore: f.freshnessScore,
      medianAgeDays: f.medianAgeDays,
      totalListings: f.totalListings,
      stalenessKey: 0
    });
  }
  mapped.sort((a, b) => {
    if (b.freshnessScore !== a.freshnessScore) {
      return b.freshnessScore - a.freshnessScore;
    }
    const aa = a.medianAgeDays ?? Number.POSITIVE_INFINITY;
    const bb = b.medianAgeDays ?? Number.POSITIVE_INFINITY;
    if (aa !== bb) return aa - bb;
    return b.totalListings - a.totalListings;
  });
  return mapped.slice(0, n);
}

/**
 * "最积压"的小区 Top N。
 * 排序：freshnessScore 升序 → medianAgeDays 降序（高龄优先）→ totalListings 降序。
 */
export function getStalestCommunityTopN(
  cityId: number | undefined,
  n: number = 5
): FreshnessRankingEntry[] {
  const all = getListingFreshness();
  const mapped: FreshnessRankingEntry[] = [];
  for (const f of all) {
    if (cityId != null && f.cityId !== cityId) continue;
    mapped.push({
      communityId: f.communityId,
      communityName: f.communityName,
      districtName: f.districtName,
      cityId: f.cityId,
      cityName: f.cityName,
      freshnessScore: f.freshnessScore,
      medianAgeDays: f.medianAgeDays,
      totalListings: f.totalListings,
      stalenessKey: 0
    });
  }
  mapped.sort((a, b) => {
    if (a.freshnessScore !== b.freshnessScore) {
      return a.freshnessScore - b.freshnessScore;
    }
    const aa = a.medianAgeDays ?? 0;
    const bb = b.medianAgeDays ?? 0;
    if (bb !== aa) return bb - aa;
    return b.totalListings - a.totalListings;
  });
  return mapped.slice(0, n);
}
