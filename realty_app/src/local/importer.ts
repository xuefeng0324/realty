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
  LocalHospital,
  LocalListing,
  LocalPoi,
  LocalSchool,
  LocalSchoolIndicator
} from "./types";

const POI_CATEGORIES = new Set(["subway", "school", "hospital", "mall", "park"]);
const HOSPITAL_LEVELS = new Set(["三甲", "三级", "二甲", "二级", "其他"]);

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
    availableWeeks
  };
}