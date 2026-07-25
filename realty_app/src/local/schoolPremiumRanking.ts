/**
 * v1.107.0 派生：学区房溢价板块级 / 区分级。
 *
 * 输入 1：snapshot.schoolPremiumCommunities（44 行，含 community × school 数据）
 * 输入 2：snapshot.schoolPremiumDistricts（17 行，含 (city, district) 聚合 + premiumRatio）
 *
 * 这 2 个数据集与 v1.101 listing_school_premium 形成三级粒度：
 *   listing × school（每 listing 一行，1278 行）
 *   community × school（每 community 一行，44 行）
 *   district × school（每 district 一行，17 行）
 *
 * 派生：
 *   - summarizeSchoolPremiumCommunityByCity: city 聚合
 *   - getSchoolPremiumCommunityTopByScore: 学区评分 Top N
 *   - getSchoolPremiumCommunityByDistrict: 单 district 全部 community
 *   - summarizeSchoolPremiumDistrictByCity: city 聚合（包含 premiumRatio）
 *   - getSchoolPremiumDistrictByCityTop: 单 city district Top N（按 premiumRatio）
 *   - getSchoolPremiumDistrictCrossCityByDistrict: 跨城同 district 名对比
 *   - getSchoolPremiumThreeTierAggregation: 三级聚合（district avg + community avg + listing avg）
 */

import {
  getSchoolPremiumCommunities,
  getSchoolPremiumDistricts
} from "./store";
import type {
  LocalSchoolPremiumCommunity,
  LocalSchoolPremiumDistrict
} from "./types";

export interface CitySchoolPremiumCommunitySummary {
  cityId: number;
  communityCount: number;
  avgSchoolCount: number;
  avgSchoolScore: number;
  totalListings: number;
  weightedMedianPrice: number | null;
  /** 该 city 学区评分 Top 1 */
  topCommunity: LocalSchoolPremiumCommunity | null;
}

export function summarizeSchoolPremiumCommunityByCity(): CitySchoolPremiumCommunitySummary[] {
  const all = getSchoolPremiumCommunities();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalSchoolPremiumCommunity[]>();
  for (const c of all) {
    let arr = grouped.get(c.cityId);
    if (!arr) {
      arr = [];
      grouped.set(c.cityId, arr);
    }
    arr.push(c);
  }
  const out: CitySchoolPremiumCommunitySummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const totalListings = arr.reduce((s, x) => s + x.listingCount, 0);
    const validPrices = arr
      .map((x) => ({ count: x.listingCount, price: x.medianUnitPrice }))
      .filter((p) => p.price != null && p.count > 0);
    const weighted =
      validPrices.length > 0
        ? validPrices.reduce((s, x) => s + x.price * x.count, 0) /
          validPrices.reduce((s, x) => s + x.count, 0)
        : null;
    const sorted = [...arr].sort((a, b) => b.avgSchoolScore - a.avgSchoolScore);
    out.push({
      cityId,
      communityCount: arr.length,
      avgSchoolCount:
        arr.reduce((s, x) => s + x.schoolCount, 0) / arr.length,
      avgSchoolScore:
        arr.reduce((s, x) => s + x.avgSchoolScore, 0) / arr.length,
      totalListings,
      weightedMedianPrice: weighted,
      topCommunity: sorted[0] ?? null
    });
  }
  out.sort((a, b) => b.avgSchoolScore - a.avgSchoolScore);
  return out;
}

/** 按学区评分 Top N */
export function getSchoolPremiumCommunityTopByScore(
  cityId: number | null,
  n: number = 5
): LocalSchoolPremiumCommunity[] {
  const all = getSchoolPremiumCommunities();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((c) => c.cityId === cityId);
  return [...pool]
    .sort((a, b) => b.avgSchoolScore - a.avgSchoolScore)
    .slice(0, n);
}

/** 单 district 全部 community（按学区评分倒序） */
export function getSchoolPremiumCommunityByDistrict(
  cityId: number,
  districtName: string
): LocalSchoolPremiumCommunity[] {
  const all = getSchoolPremiumCommunities().filter(
    (c) => c.cityId === cityId && c.districtName === districtName
  );
  return [...all].sort((a, b) => b.avgSchoolScore - a.avgSchoolScore);
}

export interface CitySchoolPremiumDistrictSummary {
  cityId: number;
  districtCount: number;
  avgSchoolScore: number;
  /** 加权平均 premiumRatio（按 listing_count 加权） */
  weightedPremiumRatio: number | null;
  /** 该城溢价最高 district */
  topDistrict: LocalSchoolPremiumDistrict | null;
}

export function summarizeSchoolPremiumDistrictByCity(): CitySchoolPremiumDistrictSummary[] {
  const all = getSchoolPremiumDistricts();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalSchoolPremiumDistrict[]>();
  for (const d of all) {
    let arr = grouped.get(d.cityId);
    if (!arr) {
      arr = [];
      grouped.set(d.cityId, arr);
    }
    arr.push(d);
  }
  const out: CitySchoolPremiumDistrictSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const validRatio = arr
      .map((d) => ({ count: d.listingCount, ratio: d.premiumRatio }))
      .filter((r) => r.count > 0);
    const weighted =
      validRatio.length > 0
        ? validRatio.reduce((s, x) => s + x.ratio * x.count, 0) /
          validRatio.reduce((s, x) => s + x.count, 0)
        : null;
    const sorted = [...arr].sort(
      (a, b) => b.premiumRatio - a.premiumRatio
    );
    out.push({
      cityId,
      districtCount: arr.length,
      avgSchoolScore:
        arr.reduce((s, x) => s + x.avgSchoolScore, 0) / arr.length,
      weightedPremiumRatio: weighted,
      topDistrict: sorted[0] ?? null
    });
  }
  out.sort((a, b) => (b.weightedPremiumRatio ?? 0) - (a.weightedPremiumRatio ?? 0));
  return out;
}

/** 单 city district Top N（按 premiumRatio 倒序） */
export function getSchoolPremiumDistrictByCityTop(
  cityId: number,
  n: number = 5
): LocalSchoolPremiumDistrict[] {
  const all = getSchoolPremiumDistricts().filter((d) => d.cityId === cityId);
  return [...all]
    .sort((a, b) => b.premiumRatio - a.premiumRatio)
    .slice(0, n);
}

/**
 * 跨城同 district 名对比（同名区在不同城市溢价差距）
 * 例：南山区（深圳）+27% vs 其他城市"南山区"是否存在
 */
export interface CrossCityDistrictEntry {
  cityId: number;
  districtName: string;
  schoolCount: number;
  avgSchoolScore: number;
  medianUnitPrice: number;
  premiumRatio: number;
}

export function getSchoolPremiumDistrictCrossCityByDistrict(
  districtName: string
): CrossCityDistrictEntry[] {
  const all = getSchoolPremiumDistricts().filter(
    (d) => d.districtName === districtName
  );
  return [...all]
    .sort((a, b) => b.premiumRatio - a.premiumRatio)
    .map((d) => ({
      cityId: d.cityId,
      districtName: d.districtName,
      schoolCount: d.schoolCount,
      avgSchoolScore: d.avgSchoolScore,
      medianUnitPrice: d.medianUnitPrice,
      premiumRatio: d.premiumRatio
    }));
}

/**
 * 三级粒度聚合（listing × community × district）的一致性检查：
 *  - v1.107 district.medianUnitPrice 应接近 city_medianUnitPrice × (1 + premiumRatio)
 *  - v1.107 community.listingCount 之和应等于 v1.107 district.listingCount 之和（同 city）
 */
export interface ThreeTierConsistency {
  cityId: number;
  cityListings: number;
  /** 该 city 所有 community 的 listing_count 求和 */
  communityListings: number;
  /** 该 city 所有 district 的 listing_count 求和 */
  districtListings: number;
  /** communityListings == districtListings */
  consistent: boolean;
}

export function getSchoolPremiumThreeTierConsistency(): ThreeTierConsistency[] {
  const communities = getSchoolPremiumCommunities();
  const districts = getSchoolPremiumDistricts();
  if (communities.length === 0 && districts.length === 0) return [];

  const grouped = new Map<
    number,
    { communityListings: number; districtListings: number }
  >();
  for (const c of communities) {
    let cur = grouped.get(c.cityId);
    if (!cur) {
      cur = { communityListings: 0, districtListings: 0 };
      grouped.set(c.cityId, cur);
    }
    cur.communityListings += c.listingCount;
  }
  for (const d of districts) {
    let cur = grouped.get(d.cityId);
    if (!cur) {
      cur = { communityListings: 0, districtListings: 0 };
      grouped.set(d.cityId, cur);
    }
    cur.districtListings += d.listingCount;
  }
  const out: ThreeTierConsistency[] = [];
  for (const [cityId, v] of grouped.entries()) {
    const sum = v.communityListings + v.districtListings;
    out.push({
      cityId,
      cityListings: sum,
      communityListings: v.communityListings,
      districtListings: v.districtListings,
      consistent: v.communityListings === v.districtListings
    });
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}