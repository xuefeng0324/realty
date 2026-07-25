/**
 * v1.112.0 派生：周边商业 POI（poi_commercial.csv，v1.112 新接入）。
 *
 * 输入：snapshot.poiCommercials（LocalPoiCommercial[]，~412 行 × 3 category）。
 * 每行：communityId + poiCategory(restaurant|bank|convenience) + rank(1-3)
 *      + poiName + poiType + distanceM + lat/lng + address
 *
 * 每个 community 每类 POI 取 Top 3，故最大 9 行/community。
 *
 * 派生：
 *   - summarizePoiCommercialByCity: city 聚合（poiCategory 计数 + 平均距离 + 跨城平均 Top3 距离）
 *   - summarizePoiCommercialByCategory: category 维度（POI 数 + 涉及 community 数 + 平均距离）
 *   - getPoiCommercialByCommunityTopByCategory: 单 community 各类最近 POI
 *   - getPoiCommercialByCommunityNearestAcross: 单 community 全部 Top 9 中最近的 N 个
 *   - getPoiCommercialByCityBankCoverage: city 内有"银行"POI 的 community 数 + 比例
 *   - getPoiCommercialByCityBankNearestByCommunity: 跨城每个 community 最近银行距离 Top
 *   - getPoiCommercialCrossCommunityByCategoryDistance: 跨 community 同类距离对比
 *   - getPoiCommercialByCityRestaurantNearestByCommunity: 跨城每个 community 最近餐饮距离
 *   - getPoiCommercialByCommunityWalkScore: 单 community "步行可达" 评分
 *     （所有 POI ≤ 200m 数量；越多越生活便利）
 *   - getPoiCommercialByCityConvenienceLeaderboard: 跨城便利店 Top 排名（按最近距离）
 *   - getPoiCommercialByPoiTypeLeaderboard: 跨 community 某 poiType 距离 Top
 */

import { getCommunityById, getPoiCommercials } from "./store";
import type { LocalPoiCommercial } from "./types";

export type PoiCommercialCategory =
  | "restaurant"
  | "bank"
  | "convenience";

export interface CityPoiCommercialSummary {
  cityId: number;
  totalPois: number;
  communityCount: number;
  /** {restaurant: count, bank: count, convenience: count} */
  categoryDistribution: Record<PoiCommercialCategory, number>;
  /** 跨城平均 Top3 距离（米） */
  avgTopDistanceM: number;
}

/** community → cityId；必须走 store，禁止硬编码 id 区间（会把深圳/珠海错归广州）。 */
function cityOf(communityId: number): number | null {
  const c = getCommunityById(communityId);
  return c?.cityId ?? null;
}

export function summarizePoiCommercialByCity(): CityPoiCommercialSummary[] {
  const all = getPoiCommercials();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalPoiCommercial[]>();
  for (const x of all) {
    const cid = cityOf(x.communityId);
    if (cid == null) continue;
    let arr = grouped.get(cid);
    if (!arr) {
      arr = [];
      grouped.set(cid, arr);
    }
    arr.push(x);
  }
  const out: CityPoiCommercialSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const cat: Record<PoiCommercialCategory, number> = {
      restaurant: 0,
      bank: 0,
      convenience: 0
    };
    for (const x of arr) cat[x.poiCategory]++;
    const communityIds = new Set(arr.map((x) => x.communityId));
    out.push({
      cityId,
      totalPois: arr.length,
      communityCount: communityIds.size,
      categoryDistribution: cat,
      avgTopDistanceM:
        arr.reduce((s, x) => s + x.distanceM, 0) / arr.length
    });
  }
  out.sort((a, b) => b.totalPois - a.totalPois);
  return out;
}

export interface CategoryPoiCommercialSummary {
  category: PoiCommercialCategory;
  poiCount: number;
  communityCount: number;
  avgTopDistanceM: number;
  minTopDistanceM: number;
  maxTopDistanceM: number;
}

export function summarizePoiCommercialByCategory(): CategoryPoiCommercialSummary[] {
  const all = getPoiCommercials();
  if (all.length === 0) return [];
  const out: CategoryPoiCommercialSummary[] = [];
  for (const cat of ["restaurant", "bank", "convenience"] as const) {
    const subset = all.filter((x) => x.poiCategory === cat);
    if (subset.length === 0) continue;
    const distances = subset.map((x) => x.distanceM);
    out.push({
      category: cat,
      poiCount: subset.length,
      communityCount: new Set(subset.map((x) => x.communityId)).size,
      avgTopDistanceM: distances.reduce((s, d) => s + d, 0) / distances.length,
      minTopDistanceM: Math.min(...distances),
      maxTopDistanceM: Math.max(...distances)
    });
  }
  return out;
}

/** 单 community 各类最近 POI（每类只取 rank=1） */
export interface CommunityCategoryTop {
  poiCategory: PoiCommercialCategory;
  poiName: string;
  distanceM: number;
  address: string;
}

export function getPoiCommercialByCommunityTopByCategory(
  communityId: number
): CommunityCategoryTop[] {
  const all = getPoiCommercials().filter((x) => x.communityId === communityId);
  const out: CommunityCategoryTop[] = [];
  for (const cat of ["restaurant", "bank", "convenience"] as const) {
    const top = all
      .filter((x) => x.poiCategory === cat)
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    if (top) {
      out.push({
        poiCategory: cat,
        poiName: top.poiName,
        distanceM: top.distanceM,
        address: top.address
      });
    }
  }
  return out;
}

/** 单 community 全部 Top 9 中最近的 N 个（跨 category） */
export function getPoiCommercialByCommunityNearestAcross(
  communityId: number,
  n: number = 3
): LocalPoiCommercial[] {
  return getPoiCommercials()
    .filter((x) => x.communityId === communityId)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n);
}

/** city 内有"银行"POI 的 community 数 + 比例 */
export interface CityBankCoverage {
  cityId: number;
  totalCommunities: number;
  bankCoveredCommunities: number;
  coverageRatio: number;
}

export function getPoiCommercialByCityBankCoverage(): CityBankCoverage[] {
  const all = getPoiCommercials();
  if (all.length === 0) return [];
  const grouped = new Map<number, Set<number>>();
  const cityAllCommunities = new Map<number, Set<number>>();
  for (const x of all) {
    const cid = cityOf(x.communityId);
    if (cid == null) continue;
    if (!grouped.has(cid)) grouped.set(cid, new Set());
    if (!cityAllCommunities.has(cid)) cityAllCommunities.set(cid, new Set());
    cityAllCommunities.get(cid)!.add(x.communityId);
    if (x.poiCategory === "bank") grouped.get(cid)!.add(x.communityId);
  }
  const out: CityBankCoverage[] = [];
  for (const [cityId, allComms] of cityAllCommunities.entries()) {
    const covered = grouped.get(cityId) ?? new Set();
    out.push({
      cityId,
      totalCommunities: allComms.size,
      bankCoveredCommunities: covered.size,
      coverageRatio:
        allComms.size === 0 ? 0 : covered.size / allComms.size
    });
  }
  out.sort((a, b) => b.coverageRatio - a.coverageRatio);
  return out;
}

/** 跨城每个 community 最近银行距离 Top N（最近 → 最远） */
export interface CommunityBankNearest {
  communityId: number;
  cityId: number;
  poiName: string;
  distanceM: number;
  address: string;
}

export function getPoiCommercialByCityBankNearestByCommunity(
  n: number = 10
): CommunityBankNearest[] {
  const all = getPoiCommercials().filter((x) => x.poiCategory === "bank");
  const grouped = new Map<number, LocalPoiCommercial>();
  for (const x of all) {
    const cur = grouped.get(x.communityId);
    if (!cur || x.distanceM < cur.distanceM) grouped.set(x.communityId, x);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n)
    .map((x) => ({
      communityId: x.communityId,
      cityId: cityOf(x.communityId) ?? 0,
      poiName: x.poiName,
      distanceM: x.distanceM,
      address: x.address
    }));
}

/** 跨 community 同 category 距离对比（每个 community 最近一个） */
export function getPoiCommercialCrossCommunityByCategoryDistance(
  category: PoiCommercialCategory,
  n: number = 10
): CommunityBankNearest[] {
  const all = getPoiCommercials().filter((x) => x.poiCategory === category);
  const grouped = new Map<number, LocalPoiCommercial>();
  for (const x of all) {
    const cur = grouped.get(x.communityId);
    if (!cur || x.distanceM < cur.distanceM) grouped.set(x.communityId, x);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n)
    .map((x) => ({
      communityId: x.communityId,
      cityId: cityOf(x.communityId) ?? 0,
      poiName: x.poiName,
      distanceM: x.distanceM,
      address: x.address
    }));
}

/** 跨城每个 community 最近餐饮距离 Top N */
export function getPoiCommercialByCityRestaurantNearestByCommunity(
  n: number = 10
): CommunityBankNearest[] {
  return getPoiCommercialCrossCommunityByCategoryDistance("restaurant", n);
}

/** 单 community "步行可达" 评分：
 *   - nearCount100: POI 距离 ≤ 100m 数量（步行 1 分钟）
 *   - nearCount200: POI 距离 100<d≤200m 数量（步行 1-3 分钟）
 *   - nearCount500: POI 距离 200<d≤500m 数量（步行 3-7 分钟）
 *   - walkScore: 加权分（≤100m=3, 100-200m=2, 200-500m=1, >500m=0）
 */
export interface WalkScore {
  communityId: number;
  nearCount100: number;
  nearCount200: number;
  nearCount500: number;
  walkScore: number;
}

export function getPoiCommercialByCommunityWalkScore(
  communityId: number
): WalkScore {
  const all = getPoiCommercials().filter((x) => x.communityId === communityId);
  let n100 = 0;
  let n200 = 0;
  let n500 = 0;
  let score = 0;
  for (const x of all) {
    if (x.distanceM <= 100) {
      n100++;
      score += 3;
    } else if (x.distanceM <= 200) {
      n200++;
      score += 2;
    } else if (x.distanceM <= 500) {
      n500++;
      score += 1;
    }
  }
  return {
    communityId,
    nearCount100: n100,
    nearCount200: n200,
    nearCount500: n500,
    walkScore: score
  };
}

/** 跨城每个 community 最近便利店距离 Top N */
export function getPoiCommercialByCityConvenienceLeaderboard(
  n: number = 10
): CommunityBankNearest[] {
  return getPoiCommercialCrossCommunityByCategoryDistance("convenience", n);
}

/** 跨 community 某 poiType 距离 Top（如 "7-ELEVEn便利店" 跨城对比） */
export interface PoiTypeLeaderboardEntry {
  communityId: number;
  cityId: number;
  poiName: string;
  distanceM: number;
}

export function getPoiCommercialByPoiTypeLeaderboard(
  poiTypeKeyword: string,
  n: number = 10
): PoiTypeLeaderboardEntry[] {
  const all = getPoiCommercials().filter((x) =>
    x.poiType.includes(poiTypeKeyword)
  );
  if (all.length === 0) return [];
  // 每个 community 该 poiType 最近的一个
  const grouped = new Map<number, LocalPoiCommercial>();
  for (const x of all) {
    const cur = grouped.get(x.communityId);
    if (!cur || x.distanceM < cur.distanceM) grouped.set(x.communityId, x);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n)
    .map((x) => ({
      communityId: x.communityId,
      cityId: cityOf(x.communityId) ?? 0,
      poiName: x.poiName,
      distanceM: x.distanceM
    }));
}