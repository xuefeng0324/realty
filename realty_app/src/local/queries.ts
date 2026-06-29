/**
 * 本地查询层 —— 跟 backend API 函数同名同签名，
 * 但数据来自本地 store.ts 而不是 HTTP。
 *
 * 这意味着：组件层 import 时从 `local/queries` 而不是 `api/*`，
 * 后续要切回 HTTP 只需要改 import 路径。
 */

import * as store from "./store";
import type {
  CommunityRankingItem,
  CommunityRankingResponse,
  DistrictCompareItem,
  DistrictCompareResponse,
  CommunityPriceTrendResponse,
  PriceTrendItem,
  QualitySummaryResponse,
  QualitySummaryBin,
  TopTagsResponse,
  TagItem,
  ListingItem,
  ListingFilterResponse,
  ListingDetailResponse,
  SchoolItem,
  SchoolFutureScoreResponse,
  CityItem
} from "../api/contracts";
import type { LocalListing } from "./types";
import {
  generateWeeklySnapshot,
  type SnapshotResult
} from "../rules/snapshot";
import { computeSchoolFutureScoreV1 } from "../rules/schoolScoring";
import { computeListingQualityScoreV1, type SchoolFutureForListing } from "../rules/listingScoring";

function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

// ---------- meta ----------
export async function getCities(): Promise<{ items: CityItem[] }> {
  const items: CityItem[] = store.getCities().map((c) => ({
    city_id: c.cityId,
    city_code: c.cityCode,
    city_name: c.cityName
  }));
  return { items };
}

export async function getPeriods(params: { cityId?: number }) {
  const weeks = store.getAvailableWeeks(params.cityId);
  return {
    type: "weekly" as const,
    items: weeks.map((w) => w.weekEndDate)
  };
}

export async function getRuntimeMeta() {
  const s = store.getSnapshot();
  return {
    database_url: "local://in-memory",
    database_file: null,
    rule_version_listing: "listing_quality_score_v1",
    rule_version_school: "school_future_score_v1",
    data_counts: {
      cities: s?.cities.length ?? 0,
      communities: s?.communities.length ?? 0,
      listings: s?.listings.length ?? 0
    },
    server_date: new Date().toISOString().slice(0, 10)
  };
}

export async function getSources(params: { cityId: number }) {
  const map = new Map<string, number>();
  for (const l of store.getListingsByCity(params.cityId)) {
    const key = l.source ?? "";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return {
    cityId: params.cityId,
    items: [...map.entries()]
      .map(([source, listing_count]) => ({ source, listing_count }))
      .sort((a, b) => b.listing_count - a.listing_count)
  };
}

export async function getCoverage(params: { cityId: number; source?: string }) {
  const communities = store.getCommunitiesByCity(params.cityId);
  const allDistricts = new Set<string>();
  for (const c of communities) {
    if (c.districtName) allDistricts.add(c.districtName);
  }
  const coveredPairs: { district_name: string; listing_count: number }[] = [];
  const districtCounts = new Map<string, number>();
  for (const l of store.getListingsByCity(params.cityId)) {
    if (params.source && l.source !== params.source) continue;
    const c = store.getCommunityById(l.communityId);
    if (!c || !c.districtName) continue;
    districtCounts.set(c.districtName, (districtCounts.get(c.districtName) ?? 0) + 1);
  }
  for (const [name, count] of districtCounts) {
    coveredPairs.push({ district_name: name, listing_count: count });
  }
  coveredPairs.sort((a, b) => b.listing_count - a.listing_count);
  const coveredNames = new Set(districtCounts.keys());
  const emptyDistricts = [...allDistricts].filter((d) => !coveredNames.has(d));
  return {
    cityId: params.cityId,
    source_used: params.source ?? "",
    total_districts: allDistricts.size,
    covered_districts: coveredNames.size,
    coverage_ratio: allDistricts.size > 0 ? coveredNames.size / allDistricts.size : 0,
    empty_districts: emptyDistricts,
    district_listing_counts: coveredPairs,
    district_community_gaps: [],
    server_date: new Date().toISOString().slice(0, 10)
  };
}

// ---------- stats ----------
function snapshotForCommunityAtWeek(
  cityId: number,
  communityId: number,
  weekEnd: string
): SnapshotResult | null {
  // 收集该 community 在 weekEnd 所在周窗口内的 unit_price（按 crawl_date desc）
  const weekEndDate = new Date(weekEnd + "T00:00:00Z");
  const weekStart = new Date(weekEndDate);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const start = weekStart.toISOString().slice(0, 10);
  const prices: number[] = [];
  for (const l of store.getListingsByCity(cityId)) {
    if (l.communityId !== communityId) continue;
    if (!l.crawlDate || !l.unitPrice) continue;
    if (l.crawlDate < start || l.crawlDate > weekEnd) continue;
    prices.push(l.unitPrice);
  }
  // 按 crawl_date desc (since we only kept dates in window, sort by crawlDate desc)
  prices.reverse(); // last-iterated order is asc; reverse to mimic desc ordering by iteration order is approximate
  // For deterministic test we sort by listingId desc as a proxy (matches "latest first" heuristic)
  return generateWeeklySnapshot({
    communityId,
    weekEndDate: weekEnd,
    unitPrices: prices
  });
}

export async function getCommunityRanking(params: {
  cityId: number;
  weekEnd: string;
  metric: "avg_unit_price" | "listing_count";
  top?: number;
  page?: number;
  pageSize?: number;
  source?: string;
}): Promise<CommunityRankingResponse> {
  const top = params.top ?? 20;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const rows: CommunityRankingItem[] = [];
  for (const c of store.getCommunitiesByCity(params.cityId)) {
    if (params.source) {
      // 仅保留本周内有指定来源房源的社区
      const has = store.getListingsByCommunity(c.communityId).some(
        (l) => l.source === params.source && l.crawlDate && l.crawlDate <= params.weekEnd && l.crawlDate >= addDays(params.weekEnd, -6)
      );
      if (!has) continue;
    }
    const snap = snapshotForCommunityAtWeek(params.cityId, c.communityId, params.weekEnd);
    if (!snap) continue;
    rows.push({
      rank: 0,
      community_id: c.communityId,
      community_name: c.communityName,
      avg_unit_price: snap.avgUnitPrice,
      median_unit_price: snap.medianUnitPrice,
      listing_count: snap.listingCount,
      coverage_score: snap.coverageScore,
      data_policy: snap.dataPolicy
    });
  }
  rows.sort((a, b) => {
    if (params.metric === "avg_unit_price") {
      const av = a.avg_unit_price ?? -Infinity;
      const bv = b.avg_unit_price ?? -Infinity;
      if (av !== bv) return bv - av;
      return b.listing_count - a.listing_count;
    }
    if (b.listing_count !== a.listing_count) return b.listing_count - a.listing_count;
    return (b.avg_unit_price ?? -Infinity) - (a.avg_unit_price ?? -Infinity);
  });
  rows.forEach((r, idx) => (r.rank = idx + 1));
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const limit = Math.min(top, pageSize);
  const data = rows.slice(offset, offset + limit);

  return {
    cityId: params.cityId,
    periodType: "weekly",
    weekEnd: params.weekEnd,
    metric: params.metric,
    top,
    page,
    pageSize,
    total,
    data
  };
}

export async function getDistrictCompare(params: {
  cityId: number;
  weekEnd: string;
  source?: string;
}): Promise<DistrictCompareResponse> {
  const weeks = new Set<string>();
  const start = addDays(params.weekEnd, -6);
  const bucket = new Map<string, { avgs: number[]; meds: number[]; count: number; covs: number[] }>();
  for (const l of store.getListingsByCity(params.cityId)) {
    if (params.source && l.source !== params.source) continue;
    if (!l.crawlDate || !l.unitPrice) continue;
    if (l.crawlDate < start || l.crawlDate > params.weekEnd) continue;
    weeks.add(weekEndFromDate(l.crawlDate));
    const c = store.getCommunityById(l.communityId);
    if (!c || !c.districtName) continue;
    const b = bucket.get(c.districtName) ?? { avgs: [], meds: [], count: 0, covs: [] };
    b.avgs.push(l.unitPrice);
    b.count++;
    bucket.set(c.districtName, b);
  }
  const items: DistrictCompareItem[] = [];
  for (const [name, b] of bucket) {
    items.push({
      district_name: name,
      avg_unit_price: avg(b.avgs),
      median_unit_price: avg(b.meds),
      listing_count: b.count,
      coverage_score: b.covs.length > 0 ? avg(b.covs) : null
    });
  }
  items.sort((a, b) => ((b.avg_unit_price ?? -Infinity) - (a.avg_unit_price ?? -Infinity)));
  return {
    cityId: params.cityId,
    periodType: "weekly",
    weekEnd: params.weekEnd,
    items
  };
}

export async function getCommunityPriceTrend(params: {
  communityId: number;
  weekEnd?: string;
}): Promise<CommunityPriceTrendResponse> {
  const community = store.getCommunityById(params.communityId);
  if (!community) throw new Error("Community not found");
  const endDate = params.weekEnd ?? new Date().toISOString().slice(0, 10);
  const startDate = addDays(endDate, -90);
  const weeks: string[] = [];
  const end = new Date(endDate + "T00:00:00Z");
  const start = new Date(startDate + "T00:00:00Z");
  for (let t = end.getTime(); t >= start.getTime(); t -= 7 * 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    weeks.push(d);
  }
  const data: PriceTrendItem[] = weeks.map((we) => {
    const snap = snapshotForCommunityAtWeek(community.cityId, params.communityId, we);
    return {
      period_start: addDays(we, -6),
      period_end: we,
      avg_unit_price: snap?.avgUnitPrice ?? null,
      median_unit_price: snap?.medianUnitPrice ?? null,
      listing_count: snap?.listingCount ?? 0,
      coverage_score: snap?.coverageScore ?? null,
      data_policy: snap?.dataPolicy ?? null,
      missingFlag: !snap
    };
  });
  return {
    communityId: params.communityId,
    community_name: community.communityName,
    periodType: "weekly",
    data
  };
}

// ---------- communities ----------
export async function getQualitySummary(params: {
  communityId: number;
  days?: number;
  includeRadar?: boolean;
}): Promise<QualitySummaryResponse> {
  const listings = store.getListingsByCommunity(params.communityId);
  if (listings.length === 0) {
    return {
      communityId: params.communityId,
      periodType: "weekly",
      days: params.days ?? 30,
      bins: [
        { bin: "0-39", count: 0 },
        { bin: "40-59", count: 0 },
        { bin: "60-79", count: 0 },
        { bin: "80-100", count: 0 }
      ],
      scoreStats: { min: 0, max: 0, avg: 0, median: 0 },
      rule_version: null,
      radar: null
    };
  }
  const scores = listings.map((l) => scoreListing(l, params.communityId));
  const vals = scores.map((s) => s.overallScore);
  const bins: QualitySummaryBin[] = [
    { bin: "0-39", count: 0 },
    { bin: "40-59", count: 0 },
    { bin: "60-79", count: 0 },
    { bin: "80-100", count: 0 }
  ];
  for (const v of vals) {
    if (v < 40) bins[0].count++;
    else if (v < 60) bins[1].count++;
    else if (v < 80) bins[2].count++;
    else bins[3].count++;
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const scoreStats = {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: avg(vals) ?? 0,
    median: sorted[Math.floor(sorted.length / 2)]
  };
  let radar: QualitySummaryResponse["radar"] = null;
  if (params.includeRadar) {
    const dims = ["location_score", "house_quality_score", "building_age_score", "amenity_score", "price_value_score"];
    const dimVals: Record<string, number[]> = {};
    dims.forEach((d) => (dimVals[d] = []));
    for (const s of scores) {
      for (const d of dims) {
        dimVals[d].push(s.dimensionScores[d] ?? 0);
      }
    }
    const values: Record<string, { avg: number; min: number; max: number }> = {};
    dims.forEach((d) => {
      const arr = dimVals[d];
      values[d] = arr.length > 0
        ? { avg: avg(arr) ?? 0, min: Math.min(...arr), max: Math.max(...arr) }
        : { avg: 0, min: 0, max: 0 };
    });
    radar = {
      rule_version: "listing_quality_score_v1",
      dimensions: dims,
      values
    };
  }
  return {
    communityId: params.communityId,
    periodType: "weekly",
    days: params.days ?? 30,
    bins,
    scoreStats,
    rule_version: "listing_quality_score_v1",
    radar
  };
}

export async function getTopTags(params: { communityId: number; limit?: number }): Promise<TopTagsResponse> {
  const limit = params.limit ?? 20;
  const advMap = new Map<string, number>();
  const disMap = new Map<string, number>();
  for (const l of store.getListingsByCommunity(params.communityId)) {
    const s = scoreListing(l, params.communityId);
    for (const a of s.advantages) advMap.set(a.label, (advMap.get(a.label) ?? 0) + 1);
    for (const d of s.disadvantages) disMap.set(d.label, (disMap.get(d.label) ?? 0) + 1);
  }
  const mk = (m: Map<string, number>): TagItem[] =>
    [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  return {
    communityId: params.communityId,
    advantages: mk(advMap),
    disadvantages: mk(disMap)
  };
}

// ---------- listings ----------
function scoreListing(l: LocalListing, communityId: number) {
  // 找小区本周均价
  const snap = snapshotForCommunityAtWeek(l.cityId, communityId, weekEndFromDate(l.crawlDate ?? new Date().toISOString().slice(0, 10)));
  const communityAvg = snap?.avgUnitPrice ?? null;
  // 关联学校
  const schoolIds = parseSchoolIds(l.schoolIdsJson);
  const schoolsFuture: SchoolFutureForListing[] = schoolIds.map((id) => {
    const sch = store.getSchoolById(id);
    const ind = store.getIndicatorsBySchool(id);
    if (!sch || !ind) return { trendScore0_100: null, provinceKeyFlag: null, cityKeyFlag: null };
    const r = computeSchoolFutureScoreV1(
      { schoolId: sch.schoolId, provinceKeyFlag: sch.provinceKeyFlag, cityKeyFlag: sch.cityKeyFlag },
      ind,
      null
    );
    return {
      trendScore0_100: r.trendScore0_100,
      provinceKeyFlag: sch.provinceKeyFlag,
      cityKeyFlag: sch.cityKeyFlag
    };
  });
  return computeListingQualityScoreV1(
    {
      listingId: l.listingId,
      communityId: l.communityId,
      orientation: l.orientation,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      floorNumber: l.floorNumber,
      hasElevator: l.hasElevator,
      decorateType: l.decorateType,
      buildYear: l.buildYear,
      unitPrice: l.unitPrice,
      nearestMetroDistanceM: l.nearestMetroDistanceM
    },
    communityAvg,
    schoolsFuture
  );
}

function parseSchoolIds(json: string | null): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  } catch {
    /* fall through */
  }
  return [];
}

export async function filterListings(req: any): Promise<ListingFilterResponse> {
  const filters = req.filters ?? {};
  let items = store.getListingsByCity(req.cityId ?? -1);
  if (req.communityId) items = items.filter((l) => l.communityId === req.communityId);
  if (filters.priceRange && Array.isArray(filters.priceRange)) {
    const [lo, hi] = filters.priceRange;
    items = items.filter((l) => l.totalPrice10k != null && l.totalPrice10k >= lo && l.totalPrice10k <= hi);
  }
  if (filters.areaRange && Array.isArray(filters.areaRange)) {
    const [lo, hi] = filters.areaRange;
    items = items.filter((l) => l.areaSqm != null && l.areaSqm >= lo && l.areaSqm <= hi);
  }
  if (filters.orientation) {
    const o = filters.orientation;
    items = items.filter((l) => l.orientation === o);
  }
  if (filters.decorateType) {
    items = items.filter((l) => l.decorateType === filters.decorateType);
  }
  if (filters.listingType && filters.listingType !== "all") {
    items = items.filter((l) => l.listingType === filters.listingType);
  }
  if (filters.hasElevator != null) {
    items = items.filter((l) => l.hasElevator === filters.hasElevator);
  }
  if (filters.minQualityScore != null) {
    const min = filters.minQualityScore;
    items = items.filter((l) => scoreListing(l, l.communityId).overallScore >= min);
  }
  if (filters.minSchoolFutureScore != null) {
    const min = filters.minSchoolFutureScore;
    items = items.filter((l) => {
      const s = scoreListing(l, l.communityId);
      return (s.schoolFutureScoreMax ?? 0) >= min;
    });
  }
  // 排序：默认按 overall_score desc
  const dir = req.sort?.direction ?? "desc";
  items.sort((a, b) => {
    const sa = scoreListing(a, a.communityId).overallScore;
    const sb = scoreListing(b, b.communityId).overallScore;
    return dir === "asc" ? sa - sb : sb - sa;
  });
  const total = items.length;
  const page = Math.max(1, req.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, req.pageSize ?? 20));
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  const listed: ListingItem[] = slice.map((l) => toListingItem(l));
  return {
    communityId: req.communityId ?? null,
    total,
    page,
    pageSize,
    rule_version: "listing_quality_score_v1",
    items: listed
  };
}

function toListingItem(l: LocalListing): ListingItem {
  const s = scoreListing(l, l.communityId);
  return {
    listing_id: l.listingId,
    title: l.title,
    listing_type: l.listingType,
    price_total: l.totalPrice10k,
    unit_price: l.unitPrice,
    area_sqm: l.areaSqm,
    orientation: l.orientation,
    floor_number: l.floorNumber,
    decorate_type: l.decorateType,
    has_elevator: l.hasElevator,
    build_year: l.buildYear,
    quality_score: s.overallScore,
    advantages: s.advantages,
    disadvantages: s.disadvantages,
    explain_preview: { overall_score: s.overallScore, dimension_scores: s.dimensionScores },
    url: l.sourceUrl
  };
}

export async function getListingDetail(listingId: number, weekEnd?: string): Promise<ListingDetailResponse> {
  const l = store.getListingById(listingId);
  if (!l) throw new Error("Listing not found");
  const s = scoreListing(l, l.communityId);
  return {
    listing: {
      listing_id: l.listingId,
      city_id: l.cityId,
      community_id: l.communityId,
      title: l.title,
      source: l.source,
      source_listing_id: l.sourceListingId,
      source_url: l.sourceUrl,
      total_price_10k: l.totalPrice10k,
      unit_price: l.unitPrice,
      area_sqm: l.areaSqm,
      listing_type: l.listingType,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      orientation: l.orientation,
      floor_number: l.floorNumber,
      has_elevator: l.hasElevator,
      decorate_type: l.decorateType,
      build_year: l.buildYear,
      nearest_metro_distance_m: l.nearestMetroDistanceM,
      school_ids_json: l.schoolIdsJson,
      tags_json: l.tagsJson,
      crawl_date: l.crawlDate
    },
    score: {
      rule_version: "listing_quality_score_v1",
      computed_week_end_date: weekEnd ?? (l.crawlDate ? weekEndFromDate(l.crawlDate) : null),
      overall_score_0_100: s.overallScore,
      dimension_scores_json: s.dimensionScores,
      advantages_json: s.advantages,
      disadvantages_json: s.disadvantages,
      explain_json: s.explainJson,
      school_future_score_max: s.schoolFutureScoreMax,
      school_province_key_flag_any: s.schoolProvinceKeyFlagAny,
      school_city_key_flag_any: s.schoolCityKeyFlagAny
    }
  };
}

// ---------- schools ----------
export async function searchSchools(params: { cityId: number; q: string }) {
  const q = params.q.toLowerCase();
  const items: SchoolItem[] = store
    .getSchoolsByCity(params.cityId)
    .filter((s) => {
      const a = (s.officialName ?? "").toLowerCase();
      const b = (s.displayName ?? "").toLowerCase();
      return a.includes(q) || b.includes(q);
    })
    .slice(0, 30)
    .map((s) => ({
      school_id: s.schoolId,
      official_name: s.officialName,
      display_name: s.displayName,
      school_type: s.schoolType,
      province_key_flag: s.provinceKeyFlag,
      city_key_flag: s.cityKeyFlag
    }));
  return { cityId: params.cityId, q: params.q, items };
}

export async function getSchoolFutureScore(params: { schoolId: number }): Promise<SchoolFutureScoreResponse> {
  const sch = store.getSchoolById(params.schoolId);
  if (!sch) throw new Error("School not found");
  const ind = store.getIndicatorsBySchool(params.schoolId);
  if (!ind) throw new Error("No indicator");
  const r = computeSchoolFutureScoreV1(
    { schoolId: sch.schoolId, provinceKeyFlag: sch.provinceKeyFlag, cityKeyFlag: sch.cityKeyFlag },
    ind,
    null
  );
  return {
    school_id: sch.schoolId,
    rule_version: r.ruleVersion,
    trend_score_0_100: r.trendScore0_100,
    confidence_score: r.confidenceScore,
    feature_contrib_json: r.featureContribJson,
    explain_text: r.explainText
  };
}

// ---------- helpers ----------
function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}