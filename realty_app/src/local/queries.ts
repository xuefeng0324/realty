/**
 * 本地查询层 —— 跟 backend API 函数同名同签名，
 * 但数据来自本地 store.ts 而不是 HTTP。
 *
 * 这意味着：组件层 import 时从 `local/queries` 而不是 `api/*`，
 * 后续要切回 HTTP 只需要改 import 路径。
 */

import * as store from "./store";
import { getWangqianDistrictNames } from "./dailyWangqian";
import type { LocalCommunityCommercial } from "./types";
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
  ListingFilterRequest,
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

const normDistrict = (d: string): string => (d ?? "").replace(/区$/, "").trim();

export async function getCoverage(params: { cityId: number; source?: string }) {
  const communities = store.getCommunitiesByCity(params.cityId);
  // 全量行政区 = 社区所在区 ∪ 政府网签分区（深圳/广州能拿到全部真实行政区），去「区」后缀归一。
  const city = store.getCityById(params.cityId);
  const allDistricts = new Set<string>();
  for (const c of communities) {
    if (c.districtName) allDistricts.add(normDistrict(c.districtName));
  }
  if (city) {
    for (const d of getWangqianDistrictNames(city.cityName)) allDistricts.add(d);
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
  const coveredNames = new Set([...districtCounts.keys()].map(normDistrict));
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

export async function filterListings(req: ListingFilterRequest): Promise<ListingFilterResponse> {
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

// ---------- POI 周边配套 (v0.4.2+) ----------

export type PoiCategory = "subway" | "school" | "hospital" | "mall" | "park";

export interface PoiItem {
  poi_category: PoiCategory;
  poi_rank: number;
  poi_name: string;
  poi_type: string;
  distance_m: number;
  lat: number;
  lng: number;
  address: string;
}

export interface CommunityPoisResponse {
  community_id: number;
  items: PoiItem[];
}

/**
 * 取某小区全部 POI（按 category, rank 排序）
 * 配套 CSV: static/seed/poi_seed.csv (crawl_amap_poi.py)
 */
export async function getCommunityPois(params: { communityId: number }): Promise<CommunityPoisResponse> {
  const rows = store.getPoisByCommunity(params.communityId);
  return {
    community_id: params.communityId,
    items: rows.map((p) => ({
      poi_category: p.poiCategory,
      poi_rank: p.poiRank,
      poi_name: p.poiName,
      poi_type: p.poiType,
      distance_m: p.distanceM,
      lat: p.lat,
      lng: p.lng,
      address: p.address
    }))
  };
}

// ---------- 城市 POI (v0.13.0+ map-view POI overlay) ----------
export interface CityPoiItem {
  communityId: number;
  poiCategory: PoiCategory;
  poiRank: number;
  poiName: string;
  poiType: string | null;
  distanceM: number;
  lat: number;
  lng: number;
  address: string | null;
}

export interface CityPoisResponse {
  cityId: number;
  total: number;
  items: CityPoiItem[];
  /** 各 category 数量 */
  counts: Record<PoiCategory, number>;
}

/**
 * 给定 cityId，返回该城市所有 POI（按 category + rank 排序）。
 * 用于 map-view 的"POI overlay"模式。
 */
export async function getCityPois(params: {
  cityId: number;
  category?: PoiCategory;
}): Promise<CityPoisResponse> {
  let rows = store.getPoisByCity(params.cityId);
  if (params.category) {
    rows = rows.filter((p) => p.poiCategory === params.category);
  }
  const counts: Record<PoiCategory, number> = {
    subway: 0,
    school: 0,
    hospital: 0,
    mall: 0,
    park: 0
  };
  for (const r of rows) counts[r.poiCategory] += 1;
  return {
    cityId: params.cityId,
    total: rows.length,
    counts,
    items: rows.map((p) => ({
      communityId: p.communityId,
      poiCategory: p.poiCategory,
      poiRank: p.poiRank,
      poiName: p.poiName,
      poiType: p.poiType,
      distanceM: p.distanceM,
      lat: p.lat,
      lng: p.lng,
      address: p.address
    }))
  };
}

// ---------- 地铁规划 (v0.15.0+) ----------
export interface MetroLineGeoItem {
  line_id: number;
  line_name: string;
  city_id: number;
  start_station: string;
  end_station: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  status: string;
  open_year_expected: number | null;
}

export interface MetroLinesGeoResponse {
  cityId: number;
  total: number;
  items: MetroLineGeoItem[];
}

/**
 * 给定 cityId，返回该城市所有地铁规划线的坐标（用于 map-view polyline）。
 * 只返回 start + end 都已有坐标的可画线。
 */
export async function getMetroLineGeos(params: {
  cityId: number;
}): Promise<MetroLinesGeoResponse> {
  const geos = store.getMetroLineGeosByCity(params.cityId);
  const lines = store.getMetroLinesByCity(params.cityId);
  const lineMap = new Map(lines.map((l) => [l.lineId, l]));
  const items: MetroLineGeoItem[] = [];
  for (const g of geos) {
    if (
      g.startLat == null || g.startLng == null ||
      g.endLat == null || g.endLng == null
    ) continue;
    const line = lineMap.get(g.lineId);
    items.push({
      line_id: g.lineId,
      line_name: g.lineName,
      city_id: g.cityId,
      start_station: g.startStation,
      end_station: g.endStation,
      start_lat: g.startLat,
      start_lng: g.startLng,
      end_lat: g.endLat,
      end_lng: g.endLng,
      status: line?.status ?? "",
      open_year_expected: line?.openYearExpected ?? null
    });
  }
  return { cityId: params.cityId, total: items.length, items };
}

// ---------- 天气 (v0.16.0+) ----------
export interface WeatherForecastDay {
  date: string;
  week: string;
  dayweather: string;
  nightweather: string;
  daytemp: string;
  nighttemp: string;
  daywind: string;
  nightwind: string;
  daypower: string;
  nightpower: string;
}

export interface WeatherLive {
  weather: string;
  temperature: string;
  winddirection: string;
  windpower: string;
  humidity: string;
  report_time: string;
}

export interface WeatherResponse {
  cityId: number;
  cityName: string;
  live: WeatherLive | null;
  forecast: WeatherForecastDay[];
  /**
   * 粗略 AQI 估算 (基于湿度 + 风力 + 温度) — 因为高德 weather API 不含真实 AQI。
   * 0 = 优 / 1 = 良 / 2 = 轻度污染 / 3 = 中度污染 / null = 无法估算
   * 仅用作演示,生产环境请接 AQICN / 国控站 API。
   */
  aqi_estimate: { level: 0 | 1 | 2 | 3 | null; label: string } | null;
  source: string;
}

/**
 * 估算 AQI (粗略):
 * - 湿度 >= 80% 且风力 <= 2 级 → 良 (因为高湿度不利于扩散)
 * - 风力 >= 5 级 → 优 (强风扩散好)
 * - 气温 > 35°C 且湿度 > 60% → 轻度污染 (高温闷热易累积污染物)
 * - 其它 → 优
 */
function estimateAqi(humidity: number | null, windpower: string, temperature: number | null): { level: 0 | 1 | 2 | 3; label: string } {
  if (humidity == null || temperature == null) {
    return { level: 1, label: "良(估算)" };
  }
  // windpower 可能是 "≤3" / "4" / "1-3"
  let wind = 0;
  const m = windpower.match(/(\d+)/g);
  if (m) {
    wind = Math.max(...m.map((x) => parseInt(x, 10)));
  }
  if (wind >= 5) return { level: 0, label: "优(估算·强风)" };
  if (humidity >= 85 && wind <= 2) return { level: 2, label: "轻度污染(估算·闷热)" };
  if (temperature >= 35 && humidity >= 60) return { level: 2, label: "轻度污染(估算·高温闷热)" };
  if (humidity >= 80) return { level: 1, label: "良(估算·高湿)" };
  return { level: 0, label: "优(估算)" };
}

export async function getWeather(params: { cityId: number }): Promise<WeatherResponse> {
  const { live, forecast } = store.getWeatherByCity(params.cityId);
  let forecastDays: WeatherForecastDay[] = [];
  if (forecast?.forecastJson) {
    try {
      forecastDays = JSON.parse(forecast.forecastJson) as WeatherForecastDay[];
    } catch {
      forecastDays = [];
    }
  }
  let aqi: { level: 0 | 1 | 2 | 3 | null; label: string } | null = null;
  if (live) {
    const h = live.humidity ? Number(live.humidity) : null;
    const t = live.temperature ? Number(live.temperature) : null;
    const est = estimateAqi(h, live.windpower, t);
    aqi = { level: est.level, label: est.label };
  }
  return {
    cityId: params.cityId,
    cityName: live?.cityName ?? forecast?.cityName ?? "",
    live: live
      ? {
          weather: live.weather,
          temperature: live.temperature,
          winddirection: live.winddirection,
          windpower: live.windpower,
          humidity: live.humidity,
          report_time: live.reportTime
        }
      : null,
    forecast: forecastDays,
    aqi_estimate: aqi,
    source: "amap:weather"
  };
}

// ---------- Listing 学区溢价 (v0.17.0+) ----------
export interface ListingSchoolPremiumItem {
  listingId: number;
  cityId: number;
  districtName: string;
  communityId: number;
  communityName: string | null;
  schoolCount: number;
  avgSchoolScore: number;
  premiumRatioEst: number;
  totalPrice10k: number | null;
  unitPrice: number | null;
  areaSqm: number | null;
  title: string;
}

export interface ListingSchoolPremiumOverview {
  cityId: number;
  cityName: string;
  total: number;
  items: ListingSchoolPremiumItem[];
}

/**
 * 给定 cityId，返回学区溢价最高 + 学区评分高的 listings (Top N)。
 * 过滤: schoolCount >= 1, avgSchoolScore > 0, unitPrice > 0
 * 排序: 先按 avg_school_score 降序, 并列按 premium_ratio_est 降序
 */
export async function getTopListingsBySchoolPremium(params: {
  cityId: number;
  minScore?: number;
  limit?: number;
}): Promise<ListingSchoolPremiumOverview> {
  const cityName = store.getCities().find((c) => c.cityId === params.cityId)?.cityName ?? "";
  const premia = store.getListingSchoolPremiumByCity(params.cityId);
  const allListings = store.getListingsByCity(params.cityId);
  const listingMap = new Map(allListings.map((l) => [l.listingId, l]));
  const communities = store.getCommunitiesByCity(params.cityId);
  const communityMap = new Map(communities.map((c) => [c.communityId, c]));

  const minScore = params.minScore ?? 70;
  const limit = params.limit ?? 10;

  const filtered = premia.filter(
    (p) =>
      p.schoolCount >= 1 &&
      p.avgSchoolScore >= minScore &&
      listingMap.has(p.listingId)
  );
  filtered.sort((a, b) => {
    if (b.avgSchoolScore !== a.avgSchoolScore) {
      return b.avgSchoolScore - a.avgSchoolScore;
    }
    return b.premiumRatioEst - a.premiumRatioEst;
  });

  const items: ListingSchoolPremiumItem[] = filtered.slice(0, limit).map((p) => {
    const l = listingMap.get(p.listingId)!;
    const c = communityMap.get(p.communityId);
    return {
      listingId: p.listingId,
      cityId: p.cityId,
      districtName: p.districtName,
      communityId: p.communityId,
      communityName: c?.communityName ?? null,
      schoolCount: p.schoolCount,
      avgSchoolScore: p.avgSchoolScore,
      premiumRatioEst: p.premiumRatioEst,
      totalPrice10k: l.totalPrice10k,
      unitPrice: l.unitPrice,
      areaSqm: l.areaSqm,
      title: l.title
    };
  });

  return {
    cityId: params.cityId,
    cityName,
    total: filtered.length,
    items
  };
}

// ---------- 医院 (v0.6.0+) ----------
export interface HospitalItem {
  hospital_id: number;
  official_name: string;
  display_name: string | null;
  hospital_type: string | null;
  hospital_level: "三甲" | "三级" | "二甲" | "二级" | "其他" | null;
  district_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  key_flag: boolean | null;
  distance_m: number | null;
}

export interface CommunityHospitalsResponse {
  community_id: number;
  /** 半径（米）；默认 3000 = poi_seed.csv hospital 类的搜索半径 */
  radius_m: number;
  items: HospitalItem[];
}

/** 计算两点球面距离（米） */
function haversineM(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000.0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * 取某小区附近 N 个医院（按距离升序）
 * 数据源：
 *   1) hospitals.csv 中该 city 的所有医院（按 lat/lng 与小区距离过滤）
 *   2) poi_seed.csv 中 poi_category=hospital 的 POI（按 community_id 直接拿）
 * 两者合并去重，按距离排序。
 *
 * 半径默认 5000m（5km），覆盖大部分城市的"几公里内"语义。
 * 如果半径内不足 limit 个，会放宽到同 district_name 的医院补足。
 */
export async function getCommunityHospitals(
  params: { communityId: number; limit?: number; radiusM?: number }
): Promise<CommunityHospitalsResponse> {
  const limit = params.limit ?? 5;
  const radius = params.radiusM ?? 5000;
  const community = store.getCommunityById(params.communityId);
  if (!community) {
    return { community_id: params.communityId, radius_m: radius, items: [] };
  }

  // 找小区经纬度
  const poisForC = store.getPoisByCommunity(params.communityId);
  const firstPoi = poisForC[0];
  let cLng: number | null = firstPoi?.lng ?? null;
  let cLat: number | null = firstPoi?.lat ?? null;
  if (cLng == null || cLat == null) {
    return { community_id: params.communityId, radius_m: radius, items: [] };
  }

  const cityHospitals = store.getHospitalsByCity(community.cityId);
  const seen = new Set<string>();
  const merged: HospitalItem[] = [];

  // 1) 半径内
  for (const h of cityHospitals) {
    if (h.lat == null || h.lng == null) continue;
    const dist = haversineM(cLng, cLat, h.lng, h.lat);
    if (dist > radius) continue;
    const key = `h-${h.hospitalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      hospital_id: h.hospitalId,
      official_name: h.officialName,
      display_name: h.displayName,
      hospital_type: h.hospitalType,
      hospital_level: h.hospitalLevel,
      district_name: h.districtName,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      key_flag: h.keyFlag,
      distance_m: Math.round(dist)
    });
  }

  // 2) poi_seed hospital 类（更精确）
  const poiHospitals = store
    .getPoisByCommunity(params.communityId)
    .filter((p) => p.poiCategory === "hospital");
  for (const p of poiHospitals) {
    const key = `p-${p.poiName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      hospital_id: -p.poiRank - params.communityId * 1000,
      official_name: p.poiName,
      display_name: null,
      hospital_type: p.poiType,
      hospital_level: null,
      district_name: null,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      key_flag: null,
      distance_m: p.distanceM
    });
  }

  // 3) 兜底：若还不够 limit 个，放宽到同 district_name 的医院（不限半径）
  if (merged.length < limit && community.districtName) {
    const inDistrict = cityHospitals.filter(
      (h) => h.districtName === community.districtName && !seen.has(`h-${h.hospitalId}`)
    );
    for (const h of inDistrict) {
      if (h.lat == null || h.lng == null) continue;
      const dist = haversineM(cLng, cLat, h.lng, h.lat);
      const key = `h-${h.hospitalId}`;
      seen.add(key);
      merged.push({
        hospital_id: h.hospitalId,
        official_name: h.officialName,
        display_name: h.displayName,
        hospital_type: h.hospitalType,
        hospital_level: h.hospitalLevel,
        district_name: h.districtName,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        key_flag: h.keyFlag,
        distance_m: Math.round(dist)
      });
      if (merged.length >= limit * 2) break;
    }
  }

  merged.sort((a, b) => (a.distance_m ?? 1e18) - (b.distance_m ?? 1e18));
  return {
    community_id: params.communityId,
    radius_m: radius,
    items: merged.slice(0, limit)
  };
}

// ---------- 地铁规划 (v0.7.0+) ----------
export interface MetroLineItem {
  line_id: number;
  line_name: string;
  phase: string | null;
  status: "规划" | "在建" | "即将开通" | null;
  length_km: number | null;
  station_count: number | null;
  start_station: string | null;
  end_station: string | null;
  max_speed_kmh: number | null;
  open_year_expected: number | null;
  districts: string[];
  /** 排序分：高/快线 + 即将开通的优先级高 */
  score: number;
  notes: string | null;
}

export interface CommunityMetroPlanningResponse {
  community_id: number;
  /** 现有最近地铁距离（米）。来自 poi_seed.csv subway 类；用于"该小区是否有地铁规划价值"判断 */
  nearest_existing_subway_m: number | null;
  items: MetroLineItem[];
}

/**
 * 取得某小区所在城市的"规划/在建地铁线路"。
 * 匹配规则：按 `district` 模糊匹配（小区 district ∈ 线路 districts 列表）。
 *
 * 排序分：
 *   - 即将开通 +20
 *   - 在建 +10
 *   - 最高速 ≥ 100km/h（快线）+5
 *   - ≥ 18 站（线网骨干）+3
 */
export async function getCommunityMetroPlanning(
  params: { communityId: number; limit?: number }
): Promise<CommunityMetroPlanningResponse> {
  const community = store.getCommunityById(params.communityId);
  if (!community) {
    return { community_id: params.communityId, nearest_existing_subway_m: null, items: [] };
  }
  const pois = store.getPoisByCommunity(params.communityId);
  const nearestSubway =
    pois.filter((p) => p.poiCategory === "subway").sort((a, b) => a.distanceM - b.distanceM)[0] ?? null;

  const lines = store.getMetroLinesByDistrict(community.cityId, community.districtName ?? "");
  const items: MetroLineItem[] = lines.map((l) => {
    let score = 0;
    if (l.status === "即将开通") score += 20;
    else if (l.status === "在建") score += 10;
    if ((l.maxSpeedKmh ?? 0) >= 100) score += 5;
    if ((l.stationCount ?? 0) >= 18) score += 3;
    return {
      line_id: l.lineId,
      line_name: l.lineName,
      phase: l.phase,
      status: l.status,
      length_km: l.lengthKm,
      station_count: l.stationCount,
      start_station: l.startStation,
      end_station: l.endStation,
      max_speed_kmh: l.maxSpeedKmh,
      open_year_expected: l.openYearExpected,
      districts: l.districts,
      score,
      notes: l.notes
    };
  });
  items.sort((a, b) => b.score - a.score);
  return {
    community_id: params.communityId,
    nearest_existing_subway_m: nearestSubway?.distanceM ?? null,
    items: items.slice(0, params.limit ?? 8)
  };
}

// ---------- 板块级周维度价格序列 (v0.8.0+) ----------
export interface DistrictTrendPoint {
  week_end: string;
  listing_count: number;
  avg_unit_price: number;
  median_unit_price: number;
  min_unit_price: number;
  max_unit_price: number;
}

export interface DistrictTrendItem {
  city_id: number;
  district_name: string;
  points: DistrictTrendPoint[];
  /** 最近一周相对 N 周前的环比变化率 (e.g. -0.012 = -1.2%)。null 表示样本不足 */
  recent_change_ratio: number | null;
  /** 最近一周均价 (元/㎡) */
  latest_avg_unit_price: number | null;
  /** 最近 4 周累计房源数 */
  recent_4w_listing_count: number;
}

/**
 * 给定城市 + 区，从 store 拿周维度价格序列，
 * 计算最近 4 周 vs 前 4 周的环比变化率。
 */
export async function getDistrictTrend(params: {
  cityId: number;
  districtName: string;
}): Promise<DistrictTrendItem | null> {
  const { cityId, districtName } = params;
  const rows = store.getDistrictTrendByDistrict(cityId, districtName);
  if (rows.length === 0) return null;

  const points: DistrictTrendPoint[] = rows.map((r) => ({
    week_end: r.weekEnd,
    listing_count: r.listingCount,
    avg_unit_price: r.avgUnitPrice,
    median_unit_price: r.medianUnitPrice,
    min_unit_price: r.minUnitPrice,
    max_unit_price: r.maxUnitPrice
  }));

  // 取最近 4 周 & 前 4 周均值，算环比
  const tail4 = rows.slice(-4);
  const prev4 = rows.slice(-8, -4);
  let recent_change_ratio: number | null = null;
  if (tail4.length >= 2 && prev4.length >= 1) {
    const tailAvg = avg(tail4.map((p) => p.avgUnitPrice));
    const prevAvg = avg(prev4.map((p) => p.avgUnitPrice));
    if (tailAvg != null && prevAvg != null && prevAvg > 0) {
      recent_change_ratio = (tailAvg - prevAvg) / prevAvg;
    }
  }

  return {
    city_id: cityId,
    district_name: districtName,
    points,
    recent_change_ratio,
    latest_avg_unit_price: tail4.length > 0 ? tail4[tail4.length - 1].avgUnitPrice : null,
    recent_4w_listing_count: tail4.reduce((s, p) => s + p.listingCount, 0)
  };
}

/**
 * 给定城市，返回所有有数据的区最近 1 周均价 + 4 周环比。
 * 用于 dashboard 卡片列表。
 */
export async function getCityDistrictOverview(params: {
  cityId: number;
}): Promise<DistrictTrendItem[]> {
  const districtNames = store.getDistrictsByCity(params.cityId);
  const out: DistrictTrendItem[] = [];
  for (const d of districtNames) {
    const item = await getDistrictTrend({ cityId: params.cityId, districtName: d });
    if (item) out.push(item);
  }
  return out;
}

// ---------- 网签热度榜 (v0.10.0+) ----------
export interface WangqianDistrictItem {
  district: string;
  totalUnits: number;
  totalAreaSqm: number;
  weeks: number;
  /** 排名 (1-based) */
  rank: number;
}

export interface WangqianOverviewItem {
  cityName: string;
  cityId: number | null;
  category: "新房" | "二手";
  items: WangqianDistrictItem[];
  /** 该城市+类别最近 N 周总成交套数 */
  totalUnits: number;
}

/**
 * 给定 cityId，返回该城市新房/二手 Top 10 区（按近 4 周总套数）。
 * 用于 dashboard "网签热度榜" 卡片。
 */
export async function getWangqianHeatmap(params: {
  cityId: number;
  category?: "新房" | "二手";
  weeksBack?: number;
  limit?: number;
}): Promise<WangqianOverviewItem | null> {
  const { cityId, category = "二手", weeksBack = 4, limit = 10 } = params;
  const city = store.getCityById(cityId);
  if (!city) return null;
  const rows = store.getWangqianTopDistricts({
    cityName: city.cityName,
    category,
    weeksBack,
    limit
  });
  if (rows.length === 0) return null;
  const items: WangqianDistrictItem[] = rows.map((r, i) => ({
    district: r.district,
    totalUnits: r.totalUnits,
    totalAreaSqm: r.totalAreaSqm,
    weeks: r.weeks,
    rank: i + 1
  }));
  return {
    cityName: city.cityName,
    cityId,
    category,
    items,
    totalUnits: items.reduce((s, it) => s + it.totalUnits, 0)
  };
}

// ---------- v0.23.0 trend-9: 区级网签热度榜 (全品类可切换) ----------
export interface DistrictWangqianRankItem {
  rank: number;
  district: string;
  totalUnits: number;
  totalAreaSqm: number;
  weeks: number;
  avgDailyUnits: number;
  avgUnitAreaSqm: number | null; // 套均面积 (avg = totalArea / totalUnits)
}

export interface DistrictWangqianRankResponse {
  cityId: number;
  cityName: string;
  category: "新房" | "二手" | "全部";
  weeksBack: number;
  totalUnits: number;
  totalAreaSqm: number;
  totalDistricts: number;
  items: DistrictWangqianRankItem[];
}

/**
 * 给定 cityId，返回该城市按区聚合的网签热度榜 (跨 category 或限定 category)。
 * "全部" = 新房+二手 一起聚合。
 */
export async function getDistrictWangqianRank(params: {
  cityId: number;
  category?: "新房" | "二手" | "全部";
  weeksBack?: number;
  limit?: number;
}): Promise<DistrictWangqianRankResponse | null> {
  const { cityId, category = "全部", weeksBack = 4, limit = 15 } = params;
  const city = store.getCityById(cityId);
  if (!city) return null;
  const cat = category === "全部" ? undefined : category;
  const rows = store.getWangqianTopDistricts({
    cityName: city.cityName,
    category: cat,
    limit: 999, // 不限 district 数
    weeksBack
  });
  if (rows.length === 0) return null;
  // 套均面积 = totalAreaSqm / totalUnits
  const items: DistrictWangqianRankItem[] = rows.map((r, i) => ({
    rank: i + 1,
    district: r.district,
    totalUnits: r.totalUnits,
    totalAreaSqm: r.totalAreaSqm,
    weeks: r.weeks,
    avgDailyUnits: r.weeks > 0 ? r.totalUnits / (r.weeks * 7) : 0,
    avgUnitAreaSqm: r.totalUnits > 0 ? r.totalAreaSqm / r.totalUnits : null
  }));
  const totalUnits = items.reduce((s, it) => s + it.totalUnits, 0);
  const totalAreaSqm = items.reduce((s, it) => s + it.totalAreaSqm, 0);
  return {
    cityId,
    cityName: city.cityName,
    category,
    weeksBack,
    totalUnits,
    totalAreaSqm,
    totalDistricts: items.length,
    items: items.slice(0, limit)
  };
}

// ---------- 学区溢价榜 (v0.11.0+) ----------
export interface SchoolPremiumItem {
  districtName: string;
  avgSchoolScore: number;
  schoolCount: number;
  listingCount: number;
  medianUnitPrice: number;
  /** (区均价 / 全市均价 - 1), e.g. 0.27 = +27% */
  premiumRatio: number;
  rank: number;
}

export interface SchoolPremiumOverview {
  cityId: number;
  cityName: string;
  items: SchoolPremiumItem[];
}

/**
 * 给定 cityId，返回该城市各区按学区溢价降序的 Top 榜。
 * 过滤 listing_count >= 10（避免小样本误导）。
 */
export async function getSchoolPremiumRank(params: {
  cityId: number;
  limit?: number;
}): Promise<SchoolPremiumOverview | null> {
  const { limit = 10 } = params;
  const city = store.getCityById(params.cityId);
  if (!city) return null;
  const rows = store.getSchoolPremiumRank({ cityId: params.cityId, limit });
  if (rows.length === 0) return null;
  return {
    cityId: params.cityId,
    cityName: city.cityName,
    items: rows
  };
}

// ---------- 学区评分小区榜 (v0.14.0+) ----------
export interface SchoolPremiumCommunityItem {
  communityId: number;
  districtName: string;
  communityName: string;
  schoolCount: number;
  avgSchoolScore: number;
  listingCount: number;
  medianUnitPrice: number;
  rank: number;
}

export interface SchoolPremiumCommunityOverview {
  cityId: number;
  cityName: string;
  items: SchoolPremiumCommunityItem[];
}

/**
 * 给定 cityId，按学区评分降序返回 Top 小区。
 * 用于 dashboard "学区评分 Top 小区" 卡片。
 */
export async function getSchoolPremiumCommunityRank(params: {
  cityId: number;
  minListings?: number;
  limit?: number;
}): Promise<SchoolPremiumCommunityOverview | null> {
  const city = store.getCityById(params.cityId);
  if (!city) return null;
  const rows = store.getSchoolPremiumCommunityRank({
    cityId: params.cityId,
    minListings: params.minListings,
    limit: params.limit
  });
  if (rows.length === 0) return null;
  return {
    cityId: params.cityId,
    cityName: city.cityName,
    items: rows
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

// ---------- 小区商业热度 (v0.19.0+) ----------
export interface CommercialRankingItem {
  rank: number;
  communityId: number;
  communityName: string;
  districtName: string;
  commercialScore: number;
  restaurantCount: number;
  bankCount: number;
  convenienceCount: number;
  nearestRestaurantM: number | null;
  nearestBankM: number | null;
  nearestConvenienceM: number | null;
}

export interface CommercialRankingResponse {
  cityId: number;
  cityName: string;
  total: number;
  items: CommercialRankingItem[];
}

/**
 * 给定 cityId，返回商业热度 Top N 小区 (按 commercial_score 降序)。
 * 过滤: commercialScore > 0
 */
export async function getCommercialRanking(params: {
  cityId: number;
  limit?: number;
  minScore?: number;
}): Promise<CommercialRankingResponse> {
  const cityName = store.getCities().find((c) => c.cityId === params.cityId)?.cityName ?? "";
  const all = store.getCommunityCommercialsByCity(params.cityId);
  const limit = params.limit ?? 10;
  const minScore = params.minScore ?? 0;
  const filtered = all
    .filter((c) => c.commercialScore > minScore)
    .sort((a, b) => b.commercialScore - a.commercialScore)
    .slice(0, limit);
  const items: CommercialRankingItem[] = filtered.map((c, idx) => ({
    rank: idx + 1,
    communityId: c.communityId,
    communityName: c.communityName,
    districtName: c.districtName,
    commercialScore: c.commercialScore,
    restaurantCount: c.restaurantCount,
    bankCount: c.bankCount,
    convenienceCount: c.convenienceCount,
    nearestRestaurantM: c.nearestRestaurantM,
    nearestBankM: c.nearestBankM,
    nearestConvenienceM: c.nearestConvenienceM
  }));
  return {
    cityId: params.cityId,
    cityName,
    total: all.filter((c) => c.commercialScore > minScore).length,
    items
  };
}

// ---------- 同区多小区对比 (v0.20.0 trend-8) ----------
export interface DistrictCommunityCompareItem {
  rank: number;
  communityId: number;
  communityName: string;
  districtName: string;
  avgUnitPrice: number | null;
  medianUnitPrice: number | null;
  listingCount: number;
  coverageScore: number;
}

export interface DistrictCommunityCompareResponse {
  cityId: number;
  cityName: string;
  districtName: string;
  weekEnd: string;
  metric: "avg_unit_price" | "listing_count";
  total: number;
  items: DistrictCommunityCompareItem[];
}

/**
 * 给定 cityId + districtName，返回该区所有 community 的横向对比 (按 metric 降序)。
 * 复用 snapshotForCommunityAtWeek (与 getCommunityRanking 一致)。
 */
export async function getCommunityCompareByDistrict(params: {
  cityId: number;
  weekEnd: string;
  districtName: string;
  metric?: "avg_unit_price" | "listing_count";
}): Promise<DistrictCommunityCompareResponse> {
  const cityName = store.getCities().find((c) => c.cityId === params.cityId)?.cityName ?? "";
  const metric = params.metric ?? "avg_unit_price";
  const rows: DistrictCommunityCompareItem[] = [];
  for (const c of store.getCommunitiesByCity(params.cityId)) {
    if (c.districtName !== params.districtName) continue;
    const snap = snapshotForCommunityAtWeek(params.cityId, c.communityId, params.weekEnd);
    if (!snap) continue;
    rows.push({
      rank: 0,
      communityId: c.communityId,
      communityName: c.communityName,
      districtName: c.districtName,
      avgUnitPrice: snap.avgUnitPrice,
      medianUnitPrice: snap.medianUnitPrice,
      listingCount: snap.listingCount,
      coverageScore: snap.coverageScore
    });
  }
  rows.sort((a, b) => {
    if (metric === "avg_unit_price") {
      const av = a.avgUnitPrice ?? -Infinity;
      const bv = b.avgUnitPrice ?? -Infinity;
      if (av !== bv) return bv - av;
      return b.listingCount - a.listingCount;
    }
    if (b.listingCount !== a.listingCount) return b.listingCount - a.listingCount;
    return (b.avgUnitPrice ?? -Infinity) - (a.avgUnitPrice ?? -Infinity);
  });
  rows.forEach((r, idx) => (r.rank = idx + 1));
  return {
    cityId: params.cityId,
    cityName,
    districtName: params.districtName,
    weekEnd: params.weekEnd,
    metric,
    total: rows.length,
    items: rows
  };
}