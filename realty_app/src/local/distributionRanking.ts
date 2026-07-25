/**
 * v1.104.0 派生：分布数据通用派生层。
 *
 * 复用以下 v0.18/v0.30/v0.44/v0.46 既有链路（types + importer + snapshotLoader + store 全部齐全）：
 *   - LocalLayoutDistribution  （layout_distribution.csv  —— 4 dimension × bucket）
 *   - LocalBedroomArea        （bedroom_area.csv        —— bedrooms × areaBucket）
 *   - LocalDecorateAge        （decorate_age.csv        —— decorate × ageBucket）
 *   - LocalOrientationFloor   （orientation_floor.csv   —— orientation × floorBucket）
 *
 * 这 4 个数据集的结构高度一致：
 *   每行 = (cityId, cityName, dimension1, dimension2, count, share, medianUnitPrice, [premiumPct])
 *
 * 通用派生（4 个数据集均可消费）：
 *   - summarizeDistributionByCity: 按 city 聚合（listing 数 / 平均单价 / 平均溢价 [如有]）
 *   - getDistributionByCityDimension: 取某 city 单维度所有 bucket（默认按 count 倒序）
 *   - getDistributionTopByMedianPrice: 取某 city 单维度溢价 / 折价 Top N
 *   - getDistributionCrossCityLeaderboard: 跨城对比"某 bucket 中谁最贵"
 *   - getDistributionShareLeaderboard: 跨城对比"某 bucket 占该城多少"
 */

import {
  getBedroomArea,
  getDecorateAge,
  getLayoutDistributions
} from "./store";
import type {
  LocalBedroomArea,
  LocalDecorateAge,
  LocalLayoutDistribution
} from "./types";

// === 4 个数据集的统一行类型 ===

export type DistributionRow =
  | LocalLayoutDistribution
  | LocalBedroomArea
  | LocalDecorateAge;

/** 取行数据的"维度"标签（用于 getDistributionByCityDimension） */
function rowDimensions(row: DistributionRow): string[] {
  if ("decorate" in row && "ageBucket" in row) {
    return [row.decorate, row.ageBucket];
  }
  if ("bedrooms" in row && "areaBucket" in row) {
    return [`${row.bedrooms}室`, row.areaBucket];
  }
  // LocalLayoutDistribution
  const ld = row as LocalLayoutDistribution;
  return [ld.dimension, ld.bucket];
}

/** 取行数据的 share / count / medianUnitPrice / premiumPct */
function rowShare(row: DistributionRow): number {
  return row.share;
}
function rowCount(row: DistributionRow): number {
  return row.count;
}
function rowMedianPrice(row: DistributionRow): number {
  // bedroom_area / decorate_age 一定有；layout 可能 null
  return (row as { medianUnitPrice: number | null }).medianUnitPrice ?? 0;
}
function rowMedianPriceOrNull(row: DistributionRow): number | null {
  return (row as { medianUnitPrice: number | null }).medianUnitPrice ?? null;
}
function rowPremiumPct(row: DistributionRow): number | null {
  // 仅 decorate_age 有 premiumPct
  if ("premiumPct" in row) {
    return (row as { premiumPct?: number }).premiumPct ?? null;
  }
  return null;
}
function rowCityId(row: DistributionRow): number {
  return row.cityId;
}
function rowCityName(row: DistributionRow): string {
  return row.cityName;
}

/** 从 store 取出 4 个数据集的全量 */
export function getAllDistributionRows(): DistributionRow[] {
  return [
    ...getLayoutDistributions(),
    ...getBedroomArea(),
    ...getDecorateAge()
  ];
}

// === 通用派生 ===

export interface CityDistributionSummary {
  cityId: number;
  cityName: string;
  rowCount: number;
  totalListings: number;
  /** 所有 bucket 加权平均单价（按 count 加权，null 跳过） */
  weightedMedianPrice: number | null;
  /** 平均 premiumPct（仅 decorate_age 包含，其他为 null） */
  avgPremiumPct: number | null;
}

export function summarizeDistributionByCity(
  source: DistributionRow[] = getAllDistributionRows()
): CityDistributionSummary[] {
  if (source.length === 0) return [];
  const grouped = new Map<number, DistributionRow[]>();
  for (const r of source) {
    let arr = grouped.get(rowCityId(r));
    if (!arr) {
      arr = [];
      grouped.set(rowCityId(r), arr);
    }
    arr.push(r);
  }
  const out: CityDistributionSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const totalListings = arr.reduce((s, x) => s + rowCount(x), 0);
    const validPrices = arr
      .map((x) => ({ count: rowCount(x), price: rowMedianPriceOrNull(x) }))
      .filter((p) => p.price != null);
    const weighted =
      validPrices.length > 0
        ? validPrices.reduce((s, x) => s + (x.price as number) * x.count, 0) /
          validPrices.reduce((s, x) => s + x.count, 0)
        : null;
    const premiums = arr
      .map((x) => rowPremiumPct(x))
      .filter((p): p is number => p != null);
    out.push({
      cityId,
      cityName: rowCityName(arr[0]!),
      rowCount: arr.length,
      totalListings,
      weightedMedianPrice: weighted,
      avgPremiumPct:
        premiums.length > 0
          ? premiums.reduce((s, x) => s + x, 0) / premiums.length
          : null
    });
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

/**
 * 取某 city 单维度所有 bucket（默认按 count 倒序）。
 * "维度"识别规则：
 *   - LocalLayoutDistribution: 用 row.dimension + row.bucket 组合
 *   - LocalBedroomArea: 用 `${bedrooms}室` + areaBucket
 *   - LocalDecorateAge: 用 decorate + ageBucket
 */
export function getDistributionByCityDimension(
  cityId: number,
  dimKey: string,
  source: DistributionRow[] = getAllDistributionRows(),
  sort: "count" | "share" = "count"
): DistributionRow[] {
  const all = source.filter((r) => rowCityId(r) === cityId);
  const filtered = all.filter((r) => {
    const dims = rowDimensions(r);
    return dims[0] === dimKey || dims.join("|") === dimKey;
  });
  if (filtered.length === 0) return [];
  if (sort === "share") {
    return [...filtered].sort((a, b) => rowShare(b) - rowShare(a));
  }
  return [...filtered].sort((a, b) => rowCount(b) - rowCount(a));
}

/** 某 city 单维度按 medianUnitPrice 倒序 Top N（null 排末尾） */
export function getDistributionTopByMedianPrice(
  cityId: number,
  n: number = 5,
  source: DistributionRow[] = getAllDistributionRows()
): DistributionRow[] {
  const all = source.filter((r) => rowCityId(r) === cityId);
  if (all.length === 0) return [];
  return [...all]
    .sort((a, b) => {
      const av = rowMedianPriceOrNull(a);
      const bv = rowMedianPriceOrNull(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    })
    .slice(0, n);
}

/**
 * 跨城对比：给定 dimKey（维度），取所有 city 中"该 bucket 维度"最贵的 Top N。
 * 例：传入 "3室" + "80-110" 找"3 室 + 80-110㎡" 哪城最贵。
 */
export interface CrossCityBucketEntry {
  cityId: number;
  cityName: string;
  dimensions: string[];
  count: number;
  medianUnitPrice: number | null;
}

export function getDistributionCrossCityLeaderboard(
  dim1: string,
  dim2: string,
  source: DistributionRow[] = getAllDistributionRows()
): CrossCityBucketEntry[] {
  const out: CrossCityBucketEntry[] = [];
  for (const r of source) {
    const dims = rowDimensions(r);
    if (
      (dims[0] === dim1 && dims[1] === dim2) ||
      dims.join("|") === `${dim1}|${dim2}`
    ) {
      out.push({
        cityId: rowCityId(r),
        cityName: rowCityName(r),
        dimensions: dims,
        count: rowCount(r),
        medianUnitPrice: rowMedianPriceOrNull(r)
      });
    }
  }
  out.sort((a, b) => {
    const av = a.medianUnitPrice ?? -Infinity;
    const bv = b.medianUnitPrice ?? -Infinity;
    return bv - av;
  });
  return out;
}

/** 跨城对比：某 dim1 在哪城占比最高 */
export interface CrossCityShareEntry {
  cityId: number;
  cityName: string;
  dimensions: string[];
  share: number;
  count: number;
}

export function getDistributionShareLeaderboard(
  dim1: string,
  source: DistributionRow[] = getAllDistributionRows()
): CrossCityShareEntry[] {
  const out: CrossCityShareEntry[] = [];
  for (const r of source) {
    const dims = rowDimensions(r);
    if (dims[0] === dim1) {
      out.push({
        cityId: rowCityId(r),
        cityName: rowCityName(r),
        dimensions: dims,
        share: rowShare(r),
        count: rowCount(r)
      });
    }
  }
  out.sort((a, b) => b.share - a.share);
  return out;
}