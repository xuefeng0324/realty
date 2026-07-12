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
  LocalCommunityCommercial,
  LocalDistrictTrend,
  LocalDistrictIndex,
  LocalHospital,
  LocalLifeConvenience,
  LocalListing,
  LocalLayoutDistribution,
  LocalListingSchoolPremium,
  LocalListingTag,
  LocalMetroLine,
  LocalMetroLineGeo,
  LocalPoi,
  LocalSchool,
  LocalSchoolIndicator,
  LocalSchoolPremiumCommunity,
  LocalSchoolPremiumDistrict,
  LocalWangqianDistrictWeekly,
  LocalWeather,
  LocalCommute
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
  /** v0.15.0: 地铁规划线坐标 (polyline 用,可选) */
  metroPlanningGeoCSV?: string;
  /** v0.16.0: 实时天气 + 4 天预报 (高德 weather API,可选) */
  weatherCSV?: string;
  /** v0.17.0: listing 维度学区评分 + 溢价率 (可选) */
  listingSchoolPremiumCSV?: string;
  /** v0.19.0: 小区商业热度评分 (可选) */
  communityCommercialCSV?: string;
  /** v0.24.0: 通勤时长 (可选) */
  commuteCSV?: string;
  /** v0.25.0: 户型/面积/朝向/装修分布 (可选) */
  layoutDistributionCSV?: string;
  /** v0.28.0: 房源 tags (单 tag 一行) */
  listingTagsCSV?: string;
  /** v0.29.0: 区级房价指数 (CSV) */
  districtIndexCSV?: string;
  /** v0.31.0: 生活便利度 */
  lifeConvenienceCSV?: string;
}

function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const LAYOUT_DIMS = new Set(["bedrooms", "area_sqm", "orientation", "decorate"]);

function parseLifeConvenience(csvText: string): LocalLifeConvenience[] {
  return rowsToObjects<Record<string, string>>(parseCSV(csvText))
    .map((r) => {
      const cid = n(r.community_id);
      if (cid == null) return null;
      const num = (v: string | undefined) => {
        if (v === undefined || v === "") return 0;
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
      };
      return {
        communityId: cid,
        cityId: n(r.city_id) ?? 0,
        districtName: s(r.district_name) ?? "",
        communityName: s(r.community_name) ?? "",
        mallNear: num(r.mall_near ?? undefined),
        parkNear: num(r.park_near ?? undefined),
        subwayNear: num(r.subway_near ?? undefined),
        schoolNear: num(r.school_near ?? undefined),
        hospitalNear: num(r.hospital_near ?? undefined),
        marketNear: num(r.market_near ?? undefined),
        score: num(r.score ?? undefined),
        score100: num(r.score100 ?? r.score ?? undefined)
      } as LocalLifeConvenience;
    })
    .filter((x): x is LocalLifeConvenience => x !== null);
}

function parseDistrictIndex(csvText: string): LocalDistrictIndex[] {
  return rowsToObjects<Record<string, string>>(parseCSV(csvText))
    .map((r) => {
      const cid = n(r.city_id);
      const dn = s(r.district_name);
      const we = s(r.week_end);
      const med = n(r.median_unit_price);
      const idx = n(r.index_value);
      const cnt = n(r.listing_count);
      if (cid == null || !dn || !we || med == null || idx == null || cnt == null) return null;
      const numOrNull = (v: string | undefined) => {
        if (v === undefined || v === "") return null;
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
      };
      return {
        cityId: cid,
        districtName: dn,
        weekEnd: we,
        medianUnitPrice: med,
        indexValue: idx,
        momChange: numOrNull(r.mom_change ?? undefined),
        yoyChange: numOrNull(r.yoy_change ?? undefined),
        listingCount: cnt
      } as LocalDistrictIndex;
    })
    .filter((x): x is LocalDistrictIndex => x !== null);
}

function parseListingTags(csvText: string): LocalListingTag[] {
  return rowsToObjects<Record<string, string>>(parseCSV(csvText))
    .map((r) => {
      const lid = n(r.listing_id);
      const cid = n(r.city_id);
      const tag = s(r.tag);
      if (lid == null || cid == null || !tag) return null;
      return {
        listingId: lid,
        cityId: cid,
        districtName: s(r.district_name) ?? "",
        tag
      } as LocalListingTag;
    })
    .filter((x): x is LocalListingTag => x !== null);
}

function parseLayoutDistribution(csvText: string): LocalLayoutDistribution[] {
  return rowsToObjects<Record<string, string>>(parseCSV(csvText))
    .map((r) => {
      const cid = n(r.city_id);
      const dim = s(r.dimension);
      const bucket = s(r.bucket);
      if (cid == null || !dim || !bucket) return null;
      if (!LAYOUT_DIMS.has(dim)) return null;
      const count = n(r.count) ?? 0;
      const share = Number(r.share ?? 0);
      const numOrNull = (v: string | undefined) => {
        if (v === undefined || v === "") return null;
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
      };
      return {
        cityId: cid,
        cityName: s(r.city_name) ?? "",
        dimension: dim as LocalLayoutDistribution["dimension"],
        bucket,
        count,
        share: Number.isFinite(share) ? share : 0,
        medianUnitPrice: numOrNull(r.median_unit_price ?? undefined),
        avgAreaSqm: numOrNull(r.avg_area_sqm ?? undefined)
      } as LocalLayoutDistribution;
    })
    .filter((x): x is LocalLayoutDistribution => x !== null);
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

  // 地铁规划线坐标 (v0.15.0+): 可选
  const metroLineGeos: LocalMetroLineGeo[] = inputs.metroPlanningGeoCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.metroPlanningGeoCSV))
        .map((r) => {
          const lid = n(r.line_id);
          const cid = n(r.city_id);
          if (lid == null || cid == null) return null;
          const confOk = (v: string | undefined): LocalMetroLineGeo["startConfidence"] => {
            const t = (v ?? "").trim();
            if (t === "high" || t === "medium" || t === "low" || t === "manual") return t;
            return "missing";
          };
          return {
            lineId: lid,
            lineName: s(r.line_name) ?? "",
            cityId: cid,
            startStation: s(r.start_station) ?? "",
            endStation: s(r.end_station) ?? "",
            startLat: n(r.start_lat),
            startLng: n(r.start_lng),
            startConfidence: confOk(r.start_confidence),
            endLat: n(r.end_lat),
            endLng: n(r.end_lng),
            endConfidence: confOk(r.end_confidence)
          } as LocalMetroLineGeo;
        })
        .filter((m): m is LocalMetroLineGeo => m !== null)
    : [];

  // 实时天气 + 预报 (v0.16.0+): 可选
  const weather: LocalWeather[] = inputs.weatherCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.weatherCSV))
        .map((r) => {
          const cid = n(r.city_id);
          const adcode = s(r.adcode);
          const rt = (s(r.report_type) ?? "") === "forecast" ? "forecast" : "live";
          if (cid == null || !adcode) return null;
          return {
            cityId: cid,
            cityName: s(r.city_name) ?? "",
            adcode,
            reportType: rt as LocalWeather["reportType"],
            reportTime: s(r.report_time) ?? "",
            weather: s(r.weather) ?? "",
            temperature: s(r.temperature) ?? "",
            winddirection: s(r.winddirection) ?? "",
            windpower: s(r.windpower) ?? "",
            humidity: s(r.humidity) ?? "",
            forecastJson: s(r.forecast_json) ?? ""
          } as LocalWeather;
        })
        .filter((m): m is LocalWeather => m !== null)
    : [];

  // listing 维度学区评分 + 溢价率 (v0.17.0+): 可选
  const listingSchoolPremia: LocalListingSchoolPremium[] = inputs.listingSchoolPremiumCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.listingSchoolPremiumCSV))
        .map((r) => {
          const lid = n(r.listing_id);
          const cid = n(r.city_id);
          const comId = n(r.community_id);
          if (lid == null || cid == null || comId == null) return null;
          return {
            listingId: lid,
            cityId: cid,
            districtName: s(r.district_name) ?? "",
            communityId: comId,
            schoolCount: n(r.school_count) ?? 0,
            avgSchoolScore: n(r.avg_school_score) ?? 0,
            premiumRatioEst: n(r.premium_ratio_est) ?? 0
          } as LocalListingSchoolPremium;
        })
        .filter((m): m is LocalListingSchoolPremium => m !== null)
    : [];

  // 小区商业热度 (v0.19.0+): 可选
  const communityCommercials: LocalCommunityCommercial[] = inputs.communityCommercialCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.communityCommercialCSV))
        .map((r) => {
          const cid = n(r.community_id);
          if (cid == null) return null;
          const cityIdRaw = n(r.city_id);
          const numOrNull = (v: string | undefined) => {
            if (v === undefined || v === "") return null;
            const x = Number(v);
            return Number.isFinite(x) ? x : null;
          };
          return {
            communityId: cid,
            cityId: cityIdRaw ?? 0,
            districtName: s(r.district_name) ?? "",
            communityName: s(r.community_name) ?? "",
            restaurantCount: n(r.restaurant_count) ?? 0,
            bankCount: n(r.bank_count) ?? 0,
            convenienceCount: n(r.convenience_count) ?? 0,
            nearestRestaurantM: numOrNull(r.nearest_restaurant_m ?? undefined),
            nearestBankM: numOrNull(r.nearest_bank_m ?? undefined),
            nearestConvenienceM: numOrNull(r.nearest_convenience_m ?? undefined),
            commercialScore: Number(r.commercial_score ?? 0)
          } as LocalCommunityCommercial;
        })
        .filter((m): m is LocalCommunityCommercial => m !== null)
    : [];

  // v0.24.0 new-5: 通勤时长 (community → CBD)
  const commutes: LocalCommute[] = inputs.commuteCSV
    ? rowsToObjects<Record<string, string>>(parseCSV(inputs.commuteCSV))
        .map((r) => {
          const cid = n(r.community_id);
          if (cid == null) return null;
          const numOrNull = (v: string | undefined) => {
            if (v === undefined || v === "") return null;
            const x = Number(v);
            return Number.isFinite(x) ? x : null;
          };
          return {
            communityId: cid,
            cityId: n(r.city_id) ?? 0,
            cityName: s(r.city_name) ?? "",
            cbdName: s(r.cbd_name) ?? "",
            cbdLat: Number(r.cbd_lat ?? 0),
            cbdLng: Number(r.cbd_lng ?? 0),
            transitMinutes: numOrNull(r.transit_minutes ?? undefined),
            transitDistanceM: numOrNull(r.transit_distance_m ?? undefined)
          } as LocalCommute;
        })
        .filter((m): m is LocalCommute => m !== null)
    : [];

  // v0.25.0 new-7: 户型/面积/朝向/装修分布
  const layoutDistributions: LocalLayoutDistribution[] = inputs.layoutDistributionCSV
    ? parseLayoutDistribution(inputs.layoutDistributionCSV)
    : [];

  // v0.28.0 new-6: 房源 tags
  const listingTags: LocalListingTag[] = inputs.listingTagsCSV
    ? parseListingTags(inputs.listingTagsCSV)
    : [];

  // v0.29.0 trend-13: 区级房价指数
  const districtIndices: LocalDistrictIndex[] = inputs.districtIndexCSV
    ? parseDistrictIndex(inputs.districtIndexCSV)
    : [];

  // v0.31.0 new-9: 生活便利度
  const lifeConveniences: LocalLifeConvenience[] = inputs.lifeConvenienceCSV
    ? parseLifeConvenience(inputs.lifeConvenienceCSV)
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
    metroLineGeos,
    weather,
    listingSchoolPremia,
    communityCommercials,
    commutes,
    layoutDistributions,
    listingTags,
    districtIndices,
    lifeConveniences,
    availableWeeks
  };
}