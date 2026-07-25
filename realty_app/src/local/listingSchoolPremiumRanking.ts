/**
 * v1.101.0 派生：listing × 学区房溢价。
 *
 * 输入：snapshot.listingSchoolPremia（LocalListingSchoolPremium[]，1278 行）。
 * 每个 listing 一行：含 listingId / cityId / districtName / communityId /
 * schoolCount / avgSchoolScore / premiumRatioEst。
 *
 * premiumRatioEst 是 (本 listing / 同区非学区房 - 1) * 100 的预估值：
 * - 0% ≈ 与同区非学区房同价
 * - 23% ≈ 比同区非学区房贵 23%（"南山区华润城润府" 类典型学区房）
 *
 * 派生：
 *   - summarizeListingSchoolPremiumByCity: 按 city 聚合（listing 数 / 平均溢价 / 高溢价占比）
 *   - getListingSchoolPremiumTopByCommunity: 按 community 聚合取溢价最高 listing（同类聚合）
 *   - getListingSchoolPremiumByCommunityLeaderboard: 按 community 取"学区溢价榜 Top N"
 *   - getListingSchoolPremiumByCityDistrict: 按 city + district 聚合（"哪个区学区溢价最猛"）
 *   - getListingSchoolPremiumDistribution: 全量 listing 溢价分布（>30 / 10-30 / 0-10 / <0）
 */

import { getListingSchoolPremia } from "./store";
import type { LocalListingSchoolPremium } from "./types";

export interface CitySchoolPremiumSummary {
  cityId: number;
  listingCount: number;
  /** 该城市有学区房溢价的 listing 数（premiumRatioEst > 0） */
  premiumListingCount: number;
  /** 平均溢价（city 全量） */
  avgPremiumPct: number;
  /** 溢价 > 10% 的 listing 占比 */
  highPremiumShare: number;
  /** 该 city 溢价最高的 listing（含 listingId / communityId / premiumRatioEst） */
  topListing: LocalListingSchoolPremium | null;
}

export function summarizeListingSchoolPremiumByCity(): CitySchoolPremiumSummary[] {
  const all = getListingSchoolPremia();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalListingSchoolPremium[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CitySchoolPremiumSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const sorted = [...arr].sort(
      (a, b) => b.premiumRatioEst - a.premiumRatioEst
    );
    const premiumListingCount = arr.filter((x) => x.premiumRatioEst > 0).length;
    const highCount = arr.filter((x) => x.premiumRatioEst > 10).length;
    out.push({
      cityId,
      listingCount: arr.length,
      premiumListingCount,
      avgPremiumPct:
        arr.reduce((s, x) => s + x.premiumRatioEst, 0) / arr.length,
      highPremiumShare: highCount / arr.length,
      topListing: sorted[0] ?? null
    });
  }
  out.sort((a, b) => b.avgPremiumPct - a.avgPremiumPct);
  return out;
}

export interface CommunityPremiumAggregate {
  communityId: number;
  districtName: string;
  listingCount: number;
  avgPremiumPct: number;
  topListing: LocalListingSchoolPremium;
}

/** 按 community 聚合：每个 community 一行（avg / top listing） */
export function aggregateListingSchoolPremiumByCommunity(
  cityId?: number
): CommunityPremiumAggregate[] {
  const all = getListingSchoolPremia();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  const grouped = new Map<number, LocalListingSchoolPremium[]>();
  for (const x of pool) {
    let arr = grouped.get(x.communityId);
    if (!arr) {
      arr = [];
      grouped.set(x.communityId, arr);
    }
    arr.push(x);
  }
  const out: CommunityPremiumAggregate[] = [];
  for (const [communityId, arr] of grouped.entries()) {
    const sorted = [...arr].sort(
      (a, b) => b.premiumRatioEst - a.premiumRatioEst
    );
    const top = sorted[0]!;
    out.push({
      communityId,
      districtName: top.districtName,
      listingCount: arr.length,
      avgPremiumPct:
        arr.reduce((s, x) => s + x.premiumRatioEst, 0) / arr.length,
      topListing: top
    });
  }
  return out;
}

/** 学区房溢价榜 Top N（按 community 平均溢价排序） */
export function getListingSchoolPremiumByCommunityLeaderboard(
  cityId: number | null,
  n: number = 5
): CommunityPremiumAggregate[] {
  const arr = aggregateListingSchoolPremiumByCommunity(
    cityId == null ? undefined : cityId
  );
  return [...arr]
    .sort((a, b) => b.avgPremiumPct - a.avgPremiumPct)
    .slice(0, n);
}

export interface DistrictPremiumSummary {
  cityId: number;
  districtName: string;
  listingCount: number;
  communityCount: number;
  avgPremiumPct: number;
  highPremiumShare: number;
}

/** 按 city × district 聚合（"哪个区学区房溢价最猛"） */
export function getListingSchoolPremiumByCityDistrict(
  cityId?: number
): DistrictPremiumSummary[] {
  const all = getListingSchoolPremia();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  const grouped = new Map<
    string,
    { cityId: number; districtName: string; arr: LocalListingSchoolPremium[] }
  >();
  for (const x of pool) {
    const key = `${x.cityId}|${x.districtName}`;
    let cur = grouped.get(key);
    if (!cur) {
      cur = {
        cityId: x.cityId,
        districtName: x.districtName,
        arr: []
      };
      grouped.set(key, cur);
    }
    cur.arr.push(x);
  }
  const out: DistrictPremiumSummary[] = [];
  const communitiesSet = new Map<string, Set<number>>();
  for (const [key, v] of grouped.entries()) {
    let s = communitiesSet.get(key);
    if (!s) {
      s = new Set();
      communitiesSet.set(key, s);
    }
    for (const x of v.arr) s.add(x.communityId);
    const high = v.arr.filter((x) => x.premiumRatioEst > 10).length;
    out.push({
      cityId: v.cityId,
      districtName: v.districtName,
      listingCount: v.arr.length,
      communityCount: s.size,
      avgPremiumPct:
        v.arr.reduce((s, x) => s + x.premiumRatioEst, 0) / v.arr.length,
      highPremiumShare: high / v.arr.length
    });
  }
  out.sort((a, b) => b.avgPremiumPct - a.avgPremiumPct);
  return out;
}

export interface PremiumBucket {
  bucket: "≥30" | "10-30" | "0-10" | "<0";
  count: number;
  share: number;
}

/** 溢价分布（按区间分桶） */
export function getListingSchoolPremiumDistribution(
  cityId?: number
): PremiumBucket[] {
  const all = getListingSchoolPremia();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  if (pool.length === 0) return [];
  const buckets: Record<PremiumBucket["bucket"], number> = {
    "≥30": 0,
    "10-30": 0,
    "0-10": 0,
    "<0": 0
  };
  for (const x of pool) {
    if (x.premiumRatioEst >= 30) buckets["≥30"]++;
    else if (x.premiumRatioEst >= 10) buckets["10-30"]++;
    else if (x.premiumRatioEst >= 0) buckets["0-10"]++;
    else buckets["<0"]++;
  }
  const total = pool.length;
  const order: PremiumBucket["bucket"][] = ["≥30", "10-30", "0-10", "<0"];
  return order.map((b) => ({
    bucket: b,
    count: buckets[b],
    share: buckets[b] / total
  }));
}