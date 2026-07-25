/**
 * v1.100.0 派生：特征画像溢价。
 *
 * 输入：snapshot.featurePremia（LocalFeaturePremium[]，每 (city, dimension, bucket) 一行）。
 * 4 个 dimension：bedrooms / area_sqm / orientation / decorate。
 * premiumPct 已是 (bucket median / city median - 1) * 100。
 *
 * 派生：
 *   - summarizeFeaturePremiumByCity: 按 city 聚合（4 维各取"溢价最高 / 折价最低" bucket）
 *   - getFeaturePremiumByCityDimension: 按 city + dimension 取全部 bucket
 *   - getFeaturePremiumTopByDimension: 取某 city + dimension 中溢价最高的 bucket
 *   - getFeaturePremiumCrossCityLeaderboard: 跨城对比某 dimension 中溢价最高的城市
 *   - getFeaturePremiumByDimensionCoverage: 全 city + 全 dimension 的 bucket 总览
 */

import { getFeaturePremia } from "./store";
import type { LocalFeaturePremium } from "./types";

export type PremiumDimension = LocalFeaturePremium["dimension"];

export interface CityPremiumSummary {
  cityId: number;
  cityName: string;
  /** 该城市溢价最高的 bucket（含 dimension / premiumPct） */
  topBucket: LocalFeaturePremium | null;
  /** 该城市折价最深的 bucket（含 dimension / premiumPct） */
  bottomBucket: LocalFeaturePremium | null;
  /** 4 个 dimension 的平均溢价 */
  avgPremiumPct: number;
}

function summarizeCity(arr: LocalFeaturePremium[]): CityPremiumSummary {
  if (arr.length === 0) {
    return {
      cityId: -1,
      cityName: "",
      topBucket: null,
      bottomBucket: null,
      avgPremiumPct: 0
    };
  }
  const sorted = [...arr].sort((a, b) => b.premiumPct - a.premiumPct);
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;
  const avg =
    arr.reduce((s, x) => s + x.premiumPct, 0) / arr.length;
  return {
    cityId: top.cityId,
    cityName: top.cityName,
    topBucket: top,
    bottomBucket: bottom,
    avgPremiumPct: avg
  };
}

export function summarizeFeaturePremiumByCity(): CityPremiumSummary[] {
  const all = getFeaturePremia();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalFeaturePremium[]>();
  for (const f of all) {
    let arr = grouped.get(f.cityId);
    if (!arr) {
      arr = [];
      grouped.set(f.cityId, arr);
    }
    arr.push(f);
  }
  const out: CityPremiumSummary[] = [];
  for (const [, arr] of grouped.entries()) {
    out.push(summarizeCity(arr));
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

/** 某 city + dimension 全部 bucket（默认按 premiumPct 倒序） */
export function getFeaturePremiumByCityDimension(
  cityId: number,
  dim: PremiumDimension,
  opts: { sort?: "premium" | "bucket" } = {}
): LocalFeaturePremium[] {
  const all = getFeaturePremia().filter(
    (f) => f.cityId === cityId && f.dimension === dim
  );
  if (all.length === 0) return [];
  const sort = opts.sort ?? "premium";
  if (sort === "premium") {
    return [...all].sort((a, b) => b.premiumPct - a.premiumPct);
  }
  return [...all].sort((a, b) =>
    a.bucket.localeCompare(b.bucket, "zh-Hans-CN")
  );
}

/** 某 city + dimension 中溢价最高的 bucket（"买单 X 最值"） */
export function getFeaturePremiumTopByDimension(
  cityId: number,
  dim: PremiumDimension
): LocalFeaturePremium | null {
  const arr = getFeaturePremiumByCityDimension(cityId, dim);
  return arr[0] ?? null;
}

export interface CrossCityPremiumLeaderboard {
  dimension: PremiumDimension;
  /** 按 premiumPct 降序，每行是该 dimension 下某城市的"最强溢价 bucket" */
  rows: LocalFeaturePremium[];
}

/** 跨城对比某 dimension 中溢价最高的"城市 × bucket"组合 */
export function getFeaturePremiumCrossCityLeaderboard(
  dim: PremiumDimension
): CrossCityPremiumLeaderboard {
  const all = getFeaturePremia().filter((f) => f.dimension === dim);
  if (all.length === 0) return { dimension: dim, rows: [] };
  // 每城取"溢价最高 bucket"
  const perCityBest = new Map<number, LocalFeaturePremium>();
  for (const f of all) {
    const cur = perCityBest.get(f.cityId);
    if (!cur || f.premiumPct > cur.premiumPct) perCityBest.set(f.cityId, f);
  }
  const rows = Array.from(perCityBest.values()).sort(
    (a, b) => b.premiumPct - a.premiumPct
  );
  return { dimension: dim, rows };
}

/**
 * 全 (city, dimension, bucket) 总览 —— 按 premiumPct 倒序取前 N。
 * 给"哪类特征最值钱"一个一图看完的视图。
 */
export function getFeaturePremiumByDimensionCoverage(
  n: number = 10
): LocalFeaturePremium[] {
  const all = getFeaturePremia();
  if (all.length === 0) return [];
  return [...all]
    .sort((a, b) => Math.abs(b.premiumPct) - Math.abs(a.premiumPct))
    .slice(0, n);
}