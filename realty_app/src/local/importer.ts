/**
 * 把 backend 导出的 4 张 CSV 解析成 DataSnapshot。
 *
 * 期望的 4 个文件（路径可由调用方传入）：
 *   1. cities.csv          city_id,city_code,city_name
 *   2. communities.csv     community_id,city_id,district_name,community_name
 *   3. schools.csv         school_id,city_id,official_name,display_name,school_type,province_key_flag,city_key_flag
 *   4. school_indicators.csv school_id,latest_level_score_raw,group_school_flag_raw,group_school_strength_raw,district_balance_level_raw,trend_delta_raw
 *   5. listings.csv        listing_id,city_id,community_id,title,source,source_listing_id,source_url,
 *                          total_price_10k,unit_price,area_sqm,listing_type,bedrooms,bathrooms,
 *                          orientation,floor_number,has_elevator,decorate_type,build_year,
 *                          nearest_metro_distance_m,school_ids_json,tags_json,crawl_date
 *
 * CSV 行格式与 backend `import_listings_csv.py` 输入一致，但允许最少字段缺失。
 */

import { parseCSV, rowsToObjects } from "./csv";
import type {
  DataSnapshot,
  LocalCity,
  LocalCommunity,
  LocalDistrictTrend,
  LocalHospital,
  LocalListing,
  LocalMetroLine,
  LocalPoi,
  LocalSchool,
  LocalSchoolIndicator,
  LocalSchoolPremiumCommunity,
  LocalSchoolPremiumDistrict,
  LocalWangqianDistrictWeekly
} from "./types";

const POI_CATEGORIES = new Set(["subway", "school", "hospital", "mall", "park"]);
const HOSPITAL_LEVELS = new Set(["三甲", "三级", "二甲", "二级", "其他"]);
const METRO_STATUSES = new Set(["规划", "在建", "即将开通"]);

function n(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t === "NULL" || t === "null") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}
function s(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" || t === "NULL" || t === "null" ? null : t;
}
function b(v: string | undefined): boolean | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  if (t === "1" || t === "true" || t === "yes" || t === "是" || t === "有") return true;
  if (t === "0" || t === "false" || t === "no" || t === "否" || t === "无") return false;
  return null;
}

export interface SnapshotInputs {
  citiesCSV: string;
  communitiesCSV: string;
  schoolsCSV: string;
  schoolIndicatorsCSV: string;
  listingsCSV: string;
  /** v0.4.2: 高德 POI (可选，缺则装空数组) */
  poisCSV?: string;
  /** v0.6.0: 医院清单 (可选，缺则装空数组) */
  hospitalsCSV?: string;
  /** v0.7.0: 规划/在建地铁线路 (可选，缺则装空数组) */
  metroPlanningCSV?: string;
  /** v0.8.0: 板块级周维度价格序列 (可选，缺则装空数组) */
  districtTrendCSV?: string;
  /** v0.10.0: 板块级周维度网签热度 (可选，缺则装空数组) */
  wangqianDistrictWeeklyCSV?: string;
  /** v0.11.0: 板块级学区溢价 (可选) */
  schoolPremiumDistrictCSV?: string;
  /** v0.11.0: 小区级学区评分 (可选) */
  schoolPremiumCommunityCSV?: string;
}

function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function importSnapshot(inputs: SnapshotInputs, source: string): DataSnapshot {
  const cityRows = rowsToObjects<Record<string, string>>(parseCSV(inputs.citiesCSV));
  const cities: LocalCity[] = cityRows.map((r) => ({
    cityId: n(r.city_id)!,
    cityCode: s(r.city_code) ?? "",
    cityName: s(r.city_name) ?? ""
  }));

  const communityRows = rowsToObjects<Record<string, string>>(parseCSV(inputs.communitiesCSV));
  const communities: LocalCommunity[] = communityRows.map((r) => ({
    communityId: n(r.community_id)!,
    cityId: n(r.city_id)!,
    districtName: s(r.district_name),
    communityName: s(r.community_name) ?? ""
  }));

  const schoolRows = rowsToObjects<Record<string, string>>(parseCSV(inputs.schoolsCSV));
  const schools: LocalSchool[] = schoolRows.map((r) => ({
    schoolId: n(r.school_id)!,
    cityId: n(r.city_id)!,
    officialName: s(r.official_name) ?? "",
    displayName: s(r.display_name),
    schoolType: s(r.school_type),
    provinceKeyFlag: b(r.province_key_flag),
    cityKeyFlag: b(r.city_key_flag)
  }));

  const indicatorRows = rowsToObjects<Record<string, string>>(parseCSV(inputs.schoolIndicatorsCSV));
  const schoolIndicators: LocalSchoolIndicator[] = indicatorRows.map((r) => ({
    schoolId: n(r.school_id)!,
    latestLevelScoreRaw: n(r.latest_level_score_raw),
    groupSchoolFlagRaw: b(r.group_school_flag_raw),
    groupSchoolStrengthRaw: n(r.group_school_strength_raw),
    districtBalanceLevelRaw: n(r.district_balance_level_raw),
    trendDeltaRaw: n(r.trend_delta_raw)
  }));

  const listingRows = rowsToObjects<Record<string, string>>(parseCSV(inputs.listingsCSV));
  const listings: LocalListing[] = listingRows.map((r) => ({
    listingId: n(r.listing_id)!,
    cityId: n(r.city_id)!,
    communityId: n(r.community_id)!,
    title: s(r.title) ?? "",
    source: s(r.source),
    sourceListingId: s(r.source_listing_id),
    sourceUrl: s(r.source_url),
    totalPrice10k: n(r.total_price_10k),
    unitPrice: n(r.unit_price),
    areaSqm: n(r.area_sqm),
    listingType: s(r.listing_type),
    bedrooms: n(r.bedrooms),
    bathrooms: n(r.bathrooms),
    orientation: s(r.orientation),
    floorNumber: s(r.floor_number),
    hasElevator: b(r.has_elevator),
    decorateType: s(r.decorate_type),
    buildYear: n(r.build_year),
    nearestMetroDistanceM: n(r.nearest_metro_distance_m),
    schoolIdsJson: s(r.school_ids_json),
    tagsJson: s(r.tags_json),
    crawlDate: s(r.crawl_date)
  }));

  // POI (v0.4.2+): 可选
  const pois: LocalPoi[] = inputs.poisCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.poisCSV))
        .map((r) => {
          const cat = (r.poi_category ?? "").trim();
          if (!POI_CATEGORIES.has(cat)) return null;
          const cid = n(r.community_id);
          const rank = n(r.poi_rank);
          const dist = n(r.distance_m);
          const lat = n(r.lat);
          const lng = n(r.lng);
          if (cid == null || rank == null || dist == null || lat == null || lng == null) {
            return null;
          }
          return {
            communityId: cid,
            poiCategory: cat as LocalPoi["poiCategory"],
            poiRank: rank,
            poiName: s(r.poi_name) ?? "",
            poiType: s(r.poi_type) ?? "",
            distanceM: dist,
            lat,
            lng,
            address: s(r.address) ?? ""
          } as LocalPoi;
        })
        .filter((p): p is LocalPoi => p !== null)
    : [];

  // 医院清单 (v0.6.0+): 可选
  const hospitals: LocalHospital[] = inputs.hospitalsCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.hospitalsCSV))
        .map((r) => {
          const hid = n(r.hospital_id);
          const cid = n(r.city_id);
          if (hid == null || cid == null) return null;
          const lvl = s(r.hospital_level);
          return {
            hospitalId: hid,
            cityId: cid,
            officialName: s(r.official_name) ?? "",
            displayName: s(r.display_name),
            hospitalType: s(r.hospital_type),
            hospitalLevel: lvl && HOSPITAL_LEVELS.has(lvl) ? (lvl as LocalHospital["hospitalLevel"]) : null,
            districtName: s(r.district_name),
            address: s(r.address),
            lat: n(r.lat),
            lng: n(r.lng),
            keyFlag: b(r.key_flag)
          } as LocalHospital;
        })
        .filter((h): h is LocalHospital => h !== null)
    : [];

  // 地铁规划 (v0.7.0+): 可选
  const metroLines: LocalMetroLine[] = inputs.metroPlanningCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.metroPlanningCSV))
        .map((r) => {
          const lid = n(r.line_id);
          const cid = n(r.city_id);
          if (lid == null || cid == null) return null;
          const st = s(r.status);
          const districts = (s(r.districts) ?? "")
            .split(";")
            .map((x) => x.trim())
            .filter(Boolean);
          return {
            lineId: lid,
            cityId: cid,
            lineName: s(r.line_name) ?? "",
            phase: s(r.phase),
            status: st && METRO_STATUSES.has(st) ? (st as LocalMetroLine["status"]) : null,
            lengthKm: n(r.length_km),
            stationCount: n(r.station_count),
            startStation: s(r.start_station),
            endStation: s(r.end_station),
            maxSpeedKmh: n(r.max_speed_kmh),
            openYearExpected: n(r.open_year_expected),
            districts,
            notes: s(r.notes)
          } as LocalMetroLine;
        })
        .filter((m): m is LocalMetroLine => m !== null)
    : [];

  // 板块级周维度价格序列 (v0.8.0+): 可选
  const districtTrends: LocalDistrictTrend[] = inputs.districtTrendCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.districtTrendCSV))
        .map((r) => {
          const cid = n(r.city_id);
          const avg = n(r.avg_unit_price);
          const med = n(r.median_unit_price);
          const cnt = n(r.listing_count);
          if (cid == null || avg == null || med == null || cnt == null) return null;
          const dn = s(r.district_name);
          const we = s(r.week_end);
          if (!dn || !we) return null;
          return {
            cityId: cid,
            districtName: dn,
            weekEnd: we,
            listingCount: cnt,
            avgUnitPrice: avg,
            medianUnitPrice: med,
            minUnitPrice: n(r.min_unit_price) ?? avg,
            maxUnitPrice: n(r.max_unit_price) ?? avg
          } as LocalDistrictTrend;
        })
        .filter((m): m is LocalDistrictTrend => m !== null)
    : [];

  // 板块级周维度网签热度 (v0.10.0+): 可选
  const wangqianDistrictWeekly: LocalWangqianDistrictWeekly[] = inputs.wangqianDistrictWeeklyCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.wangqianDistrictWeeklyCSV))
        .map((r) => {
          const city = s(r.city);
          const district = s(r.district);
          const we = s(r.week_end);
          const cat = s(r.category);
          const days = n(r.days);
          const units = n(r.total_units);
          const area = n(r.total_area_sqm);
          const avgU = n(r.avg_daily_units);
          const avgA = n(r.avg_daily_area_sqm);
          if (!city || !district || !we || !cat || days == null || units == null || area == null) {
            return null;
          }
          // 标准化 category
          const normCat: LocalWangqianDistrictWeekly["category"] =
            cat === "新房" ? "新房" : cat === "二手" ? "二手" : "其他";
          return {
            city,
            district,
            category: normCat,
            weekEnd: we,
            days,
            totalUnits: units,
            totalAreaSqm: area,
            avgDailyUnits: avgU ?? units / Math.max(1, days),
            avgDailyAreaSqm: avgA ?? area / Math.max(1, days)
          } as LocalWangqianDistrictWeekly;
        })
        .filter((m): m is LocalWangqianDistrictWeekly => m !== null)
    : [];

  // 板块级学区溢价 (v0.11.0+): 可选
  const schoolPremiumDistricts: LocalSchoolPremiumDistrict[] = inputs.schoolPremiumDistrictCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.schoolPremiumDistrictCSV))
        .map((r) => {
          const cid = n(r.city_id);
          const sc = n(r.school_count);
          const avg = n(r.avg_school_score);
          const lc = n(r.listing_count);
          const mp = n(r.median_unit_price);
          const cmp = n(r.city_median_unit_price);
          const pr = n(r.premium_ratio);
          const dn = s(r.district_name);
          if (
            cid == null || sc == null || lc == null ||
            mp == null || cmp == null || pr == null || !dn
          ) {
            return null;
          }
          return {
            cityId: cid,
            districtName: dn,
            schoolCount: sc,
            avgSchoolScore: avg ?? 0,
            listingCount: lc,
            medianUnitPrice: mp,
            cityMedianUnitPrice: cmp,
            premiumRatio: pr
          } as LocalSchoolPremiumDistrict;
        })
        .filter((m): m is LocalSchoolPremiumDistrict => m !== null)
    : [];

  // 小区级学区评分 (v0.11.0+): 可选
  const schoolPremiumCommunities: LocalSchoolPremiumCommunity[] = inputs.schoolPremiumCommunityCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.schoolPremiumCommunityCSV))
        .map((r) => {
          const cid = n(r.community_id);
          const cityId = n(r.city_id);
          const sc = n(r.school_count);
          const avg = n(r.avg_school_score);
          const lc = n(r.listing_count);
          const mp = n(r.median_unit_price);
          const dn = s(r.district_name);
          const cn = s(r.community_name);
          if (
            cid == null || cityId == null || sc == null ||
            lc == null || mp == null || !dn || !cn
          ) {
            return null;
          }
          return {
            communityId: cid,
            cityId,
            districtName: dn,
            communityName: cn,
            schoolCount: sc,
            avgSchoolScore: avg ?? 0,
            listingCount: lc,
            medianUnitPrice: mp
          } as LocalSchoolPremiumCommunity;
        })
        .filter((m): m is LocalSchoolPremiumCommunity => m !== null)
    : [];

  // 聚合可用周：基于 listings 的 crawl_date
  const weekEnds = new Set<string>();
  for (const l of listings) {
    if (l.crawlDate) weekEnds.add(weekEndFromDate(l.crawlDate));
  }
  const sortedWeekEnds = [...weekEnds].sort();
  const availableWeeks = sortedWeekEnds.map((we) => {
    const start = new Date(we + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() - 6);
    return { weekStartDate: start.toISOString().slice(0, 10), weekEndDate: we };
  });

  return {
    importedAt: new Date().toISOString(),
    source,
    cities,
    communities,
    schools,
    schoolIndicators,
    listings,
    pois,
    hospitals,
    metroLines,
    districtTrends,
    wangqianDistrictWeekly,
    schoolPremiumDistricts,
    schoolPremiumCommunities,
    availableWeeks
  };
}