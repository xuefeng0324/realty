/**
 * v1.103.0 派生：周边商业热度。
 *
 * 输入：snapshot.communityCommercials（LocalCommunityCommercial[]，42 行）。
 * 每个小区一行，含 3 类 POI 计数 / 3 类最近距离 / commercial_score（0-100）。
 * 3 类 POI：restaurant / bank / convenience。
 *
 * 派生：
 *   - summarizeCommunityCommercialByCity: 按 city 聚合（小区数 / 各 POI 平均最近距离 / 平均 score）
 *   - getCommunityCommercialByScoreTopN: 按 commercialScore 取全市/单 city Top N
 *   - getCommunityCommercialByNearest: 单 POI 类型最近的小区榜（"最近饭店/最近银行/最近便利店"）
 *   - getCommunityCommercialByCityDistrict: 按 city × district 聚合（"哪个区商业最强"）
 *   - getCommunityCommercialDensityVsDistance: 检查"POI 数 × 平均最近距离"悖论（密度高但距离远则密度可能虚高）
 */

import { getCommunityCommercials } from "./store";
import type { LocalCommunityCommercial } from "./types";

export type CommercialPoiType =
  | "restaurant"
  | "bank"
  | "convenience";

export interface CityCommercialSummary {
  cityId: number;
  communityCount: number;
  avgCommercialScore: number;
  avgRestaurantCount: number;
  avgBankCount: number;
  avgConvenienceCount: number;
  /** 3 类 POI 的平均最近距离（米，null 跳过） */
  avgNearestRestaurantM: number | null;
  avgNearestBankM: number | null;
  avgNearestConvenienceM: number | null;
}

function safeAvg(xs: (number | null)[]): number | null {
  const valid = xs.filter((x): x is number => x != null);
  return valid.length > 0
    ? valid.reduce((s, x) => s + x, 0) / valid.length
    : null;
}

function summarizeCity(
  cityId: number,
  arr: LocalCommunityCommercial[]
): CityCommercialSummary {
  return {
    cityId,
    communityCount: arr.length,
    avgCommercialScore:
      arr.reduce((s, x) => s + x.commercialScore, 0) / arr.length,
    avgRestaurantCount:
      arr.reduce((s, x) => s + x.restaurantCount, 0) / arr.length,
    avgBankCount:
      arr.reduce((s, x) => s + x.bankCount, 0) / arr.length,
    avgConvenienceCount:
      arr.reduce((s, x) => s + x.convenienceCount, 0) / arr.length,
    avgNearestRestaurantM: safeAvg(arr.map((x) => x.nearestRestaurantM)),
    avgNearestBankM: safeAvg(arr.map((x) => x.nearestBankM)),
    avgNearestConvenienceM: safeAvg(arr.map((x) => x.nearestConvenienceM))
  };
}

export function summarizeCommunityCommercialByCity(): CityCommercialSummary[] {
  const all = getCommunityCommercials();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalCommunityCommercial[]>();
  for (const c of all) {
    let arr = grouped.get(c.cityId);
    if (!arr) {
      arr = [];
      grouped.set(c.cityId, arr);
    }
    arr.push(c);
  }
  const out: CityCommercialSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    out.push(summarizeCity(cityId, arr));
  }
  out.sort((a, b) => b.avgCommercialScore - a.avgCommercialScore);
  return out;
}

/** 按 commercialScore 取 Top N */
export function getCommunityCommercialByScoreTopN(
  cityId: number | null,
  n: number = 5
): LocalCommunityCommercial[] {
  const all = getCommunityCommercials();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((x) => x.cityId === cityId);
  return pool.sort((a, b) => b.commercialScore - a.commercialScore).slice(0, n);
}

/** 单 POI 类型最近的小区榜 */
export function getCommunityCommercialByNearest(
  poiType: CommercialPoiType,
  cityId: number | null,
  n: number = 5
): LocalCommunityCommercial[] {
  const all = getCommunityCommercials();
  if (all.length === 0) return [];
  const pool =
    cityId == null ? [...all] : all.filter((x) => x.cityId === cityId);
  const fieldKey =
    poiType === "restaurant"
      ? "nearestRestaurantM"
      : poiType === "bank"
      ? "nearestBankM"
      : "nearestConvenienceM";
  const filtered = pool.filter((x) => x[fieldKey] != null);
  return [...filtered]
    .sort((a, b) => (a[fieldKey] ?? 0) - (b[fieldKey] ?? 0))
    .slice(0, n);
}

export interface DistrictCommercialSummary {
  cityId: number;
  districtName: string;
  communityCount: number;
  avgCommercialScore: number;
  /** 该 district 在所有 district 中的排名（1-based，按 avgCommercialScore 降序） */
  rankOverall: number;
}

export function getCommunityCommercialByCityDistrict(
  cityId?: number
): DistrictCommercialSummary[] {
  const all = getCommunityCommercials();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  const grouped = new Map<
    string,
    { cityId: number; districtName: string; arr: LocalCommunityCommercial[] }
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
  const out: DistrictCommercialSummary[] = [];
  for (const [, v] of grouped.entries()) {
    out.push({
      cityId: v.cityId,
      districtName: v.districtName,
      communityCount: v.arr.length,
      avgCommercialScore:
        v.arr.reduce((s, x) => s + x.commercialScore, 0) / v.arr.length,
      rankOverall: 0
    });
  }
  out.sort((a, b) => b.avgCommercialScore - a.avgCommercialScore);
  out.forEach((d, i) => {
    d.rankOverall = i + 1;
  });
  return out;
}

/**
 * 密度 / 距离悖论检查：density = count, dist = nearestM。
 * "高 count + 低距离" 是真的好（密度高 + 离得近）。
 * "高 count + 高距离" 可能 POI 数虚高（如 1 公里外有大商场但小区门口空）。
 * "低 count + 低距离" 是低密度但周边齐全（如老城）。
 * "低 count + 高距离" 是真空。
 */
export interface DensityDistanceBucket {
  bucket: "高密度近" | "高密度远" | "低密度近" | "低密度远";
  count: number;
  communities: Array<{ communityId: number; communityName: string; districtName: string }>;
}

export function getCommunityCommercialDensityVsDistance(
  poiType: CommercialPoiType,
  densityThreshold: number = 2.5,
  distanceThreshold: number = 200
): DensityDistanceBucket[] {
  const all = getCommunityCommercials();
  // 即使空 snapshot 也返回 4 个空 bucket（保持 bucket 顺序一致）
  const fieldKey =
    poiType === "restaurant"
      ? "nearestRestaurantM"
      : poiType === "bank"
      ? "nearestBankM"
      : "nearestConvenienceM";
  const countKey =
    poiType === "restaurant"
      ? "restaurantCount"
      : poiType === "bank"
      ? "bankCount"
      : "convenienceCount";
  const buckets: Record<DensityDistanceBucket["bucket"], DensityDistanceBucket> = {
    "高密度近": { bucket: "高密度近", count: 0, communities: [] },
    "高密度远": { bucket: "高密度远", count: 0, communities: [] },
    "低密度近": { bucket: "低密度近", count: 0, communities: [] },
    "低密度远": { bucket: "低密度远", count: 0, communities: [] }
  };
  for (const c of all) {
    const cnt = c[countKey];
    const dist = c[fieldKey];
    if (dist == null) continue;
    const highDensity = cnt >= densityThreshold;
    const near = dist <= distanceThreshold;
    const key: DensityDistanceBucket["bucket"] =
      highDensity && near
        ? "高密度近"
        : highDensity && !near
        ? "高密度远"
        : !highDensity && near
        ? "低密度近"
        : "低密度远";
    buckets[key].count++;
    buckets[key].communities.push({
      communityId: c.communityId,
      communityName: c.communityName,
      districtName: c.districtName
    });
  }
  return [
    buckets["高密度近"],
    buckets["高密度远"],
    buckets["低密度近"],
    buckets["低密度远"]
  ];
}