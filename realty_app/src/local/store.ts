/**
 * 简单的内存数据层（阶段 A 替代 SQLite）。
 *
 * 设计原则：
 * - 一次加载完整快照到内存
 * - 提供与 backend API 等价的查询函数（getCities / getCommunityRanking / ...）
 * - 后续接 SQLite 时，把这些函数内部换成 SQL，外部签名保持不变
 *
 * 当前容量假设：demo 数据 < 5000 套房源，浏览器/App 内存轻松放下。
 * 真要上几万套房源时，再考虑接 SQLite + 索引。
 */

import type {
  DataSnapshot,
  LocalCity,
  LocalCommunity,
  LocalCommunityCommercial,
  LocalCommute,
  LocalDailyWangqianRow,
  LocalDistrictTrend,
  LocalHospital,
  LocalLayoutDistribution,
  LocalListing,
  LocalListingSchoolPremium,
  LocalListingTag,
  LocalMetroLine,
  LocalMetroLineGeo,
  LocalPoi,
  LocalSchool,
  LocalSchoolPremiumCommunity,
  LocalSchoolPremiumDistrict,
  LocalStats70Row,
  LocalWangqianDistrictWeekly,
  LocalWeather
} from "./types";

let snapshot: DataSnapshot | null = null;

/** 国家统计局 70 城价格指数，独立于 business 数据快照。 */
let stats70: LocalStats70Row[] = [];

/** 深广政府网签日更，独立于 business 数据快照。 */
let dailyWangqian: LocalDailyWangqianRow[] = [];

export function setSnapshot(s: DataSnapshot) {
  snapshot = s;
}

export function getSnapshot(): DataSnapshot | null {
  return snapshot;
}

export function isLoaded(): boolean {
  return snapshot != null;
}

/** 注入 70 城指数（一般是启动时从 local CSV 读取）。 */
export function setStats70(rows: LocalStats70Row[]) {
  stats70 = rows;
}

/** 返回全部 70 城指数行（只读复制）。 */
export function getStats70(): LocalStats70Row[] {
  return stats70;
}

export function hasStats70(): boolean {
  return stats70.length > 0;
}

/**
 * 查询某城市的所有指数行，按 date 升序。
 * 城市名匹配做"市区"后缀容忍：传"上海"也能匹配"上海市"。
 */
export function getStats70ByCity(cityName: string): LocalStats70Row[] {
  const target = (cityName ?? "").replace(/市$/, "");
  return stats70.filter((r) => r.city === target);
}

export function setDailyWangqian(rows: LocalDailyWangqianRow[]) {
  dailyWangqian = rows;
}

export function getDailyWangqian(): LocalDailyWangqianRow[] {
  return dailyWangqian;
}

export function hasDailyWangqian(): boolean {
  return dailyWangqian.length > 0;
}

export function getDailyWangqianByCity(cityName: string): LocalDailyWangqianRow[] {
  const target = (cityName ?? "").replace(/市$/, "");
  return dailyWangqian.filter((r) => r.city === target);
}

/**
 * 给定一组城市名，返回每城市的"最新一条"指数（优先取 同比 / new_idx）。
 * 用于 dashboard 卡片显示。
 */
export function getLatestStatsForCities(cityNames: string[]): Map<string, LocalStats70Row> {
  const out = new Map<string, LocalStats70Row>();
  for (const name of cityNames) {
    const rows = getStats70ByCity(name);
    if (rows.length === 0) continue;
    out.set(name, rows[rows.length - 1]);
  }
  return out;
}

export function getCities(): LocalCity[] {
  return snapshot?.cities ?? [];
}

export function getCityById(cityId: number): LocalCity | undefined {
  return snapshot?.cities.find((c) => c.cityId === cityId);
}

export function getCommunitiesByCity(cityId: number): LocalCommunity[] {
  return (snapshot?.communities ?? []).filter((c) => c.cityId === cityId);
}

export function getCommunityById(communityId: number): LocalCommunity | undefined {
  return snapshot?.communities.find((c) => c.communityId === communityId);
}

export function getSchoolsByCity(cityId: number): LocalSchool[] {
  return (snapshot?.schools ?? []).filter((s) => s.cityId === cityId);
}

export function getSchoolById(schoolId: number): LocalSchool | undefined {
  return snapshot?.schools.find((s) => s.schoolId === schoolId);
}

export function getIndicatorsBySchool(schoolId: number) {
  return (snapshot?.schoolIndicators ?? []).find((i) => i.schoolId === schoolId);
}

export function getListingsByCity(cityId: number): LocalListing[] {
  return (snapshot?.listings ?? []).filter((l) => l.cityId === cityId);
}

export function getListingById(listingId: number): LocalListing | undefined {
  return snapshot?.listings.find((l) => l.listingId === listingId);
}

export function getListingsByCommunity(communityId: number): LocalListing[] {
  return (snapshot?.listings ?? []).filter((l) => l.communityId === communityId);
}

/**
 * POI 周边配套 (v0.4.2+)
 * 返回某小区全部 POI 行，按 category → rank 排序。
 */
export function getPoisByCommunity(communityId: number): LocalPoi[] {
  return (snapshot?.pois ?? [])
    .filter((p) => p.communityId === communityId)
    .sort((a, b) => {
      if (a.poiCategory !== b.poiCategory) {
        return a.poiCategory.localeCompare(b.poiCategory);
      }
      return a.poiRank - b.poiRank;
    });
}

/**
 * 按 category 聚合最近 N 个 POI（默认 3）
 */
export function getTopPoisByCategory(
  communityId: number,
  category: LocalPoi["poiCategory"],
  limit = 3
): LocalPoi[] {
  return getPoisByCommunity(communityId)
    .filter((p) => p.poiCategory === category)
    .slice(0, limit);
}

/**
 * 给定 cityId，返回该城市所有 POI（按 category + rank 排序）。
 * 用于 map-view 的"POI overlay" 模式：把所有 POI 点画到地图上。
 * 关联逻辑：poi_seed.csv 的 community_id → communities.csv 的 city_id。
 */
export function getPoisByCity(cityId: number): LocalPoi[] {
  if (!snapshot) return [];
  const cityCommunities = new Set(
    (snapshot.communities ?? [])
      .filter((c) => c.cityId === cityId)
      .map((c) => c.communityId)
  );
  return (snapshot.pois ?? [])
    .filter((p) => cityCommunities.has(p.communityId))
    .sort((a, b) => {
      if (a.poiCategory !== b.poiCategory) {
        return a.poiCategory.localeCompare(b.poiCategory);
      }
      return a.poiRank - b.poiRank;
    });
}

/**
 * 医院清单 (v0.6.0+)
 */
export function getHospitals(): LocalHospital[] {
  return snapshot?.hospitals ?? [];
}

export function getHospitalsByCity(cityId: number): LocalHospital[] {
  return (snapshot?.hospitals ?? []).filter((h) => h.cityId === cityId);
}

export function getHospitalById(hospitalId: number): LocalHospital | undefined {
  return snapshot?.hospitals.find((h) => h.hospitalId === hospitalId);
}

export function getHospitalsByDistrict(cityId: number, districtName: string): LocalHospital[] {
  return (snapshot?.hospitals ?? []).filter(
    (h) => h.cityId === cityId && h.districtName === districtName
  );
}

/**
 * 地铁规划 (v0.7.0+)
 */
export function getMetroLines(): LocalMetroLine[] {
  return snapshot?.metroLines ?? [];
}

export function getMetroLinesByCity(cityId: number): LocalMetroLine[] {
  return (snapshot?.metroLines ?? []).filter((m) => m.cityId === cityId);
}

/**
 * 给定城市 + 区，匹配在该区规划的地铁线路（在建/即将开通）
 */
export function getMetroLinesByDistrict(cityId: number, districtName: string): LocalMetroLine[] {
  return (snapshot?.metroLines ?? []).filter(
    (m) =>
      m.cityId === cityId &&
      m.districts.some((d) => d === districtName)
  );
}

/**
 * 地铁规划线坐标 (v0.15.0+) — 用于 map-view polyline
 */
export function getMetroLineGeos(): LocalMetroLineGeo[] {
  return snapshot?.metroLineGeos ?? [];
}

export function getMetroLineGeosByCity(cityId: number): LocalMetroLineGeo[] {
  return (snapshot?.metroLineGeos ?? []).filter((m) => m.cityId === cityId);
}

/**
 * 实时天气 + 预报 (v0.16.0+)
 */
export function getWeather(): LocalWeather[] {
  return snapshot?.weather ?? [];
}

export function getWeatherByCity(cityId: number): {
  live: LocalWeather | null;
  forecast: LocalWeather | null;
} {
  const all = (snapshot?.weather ?? []).filter((w) => w.cityId === cityId);
  return {
    live: all.find((w) => w.reportType === "live") ?? null,
    forecast: all.find((w) => w.reportType === "forecast") ?? null
  };
}

/**
 * Listing 维度学区评分 (v0.17.0+)
 */
export function getListingSchoolPremia(): LocalListingSchoolPremium[] {
  return snapshot?.listingSchoolPremia ?? [];
}

export function getListingSchoolPremiumByCity(cityId: number): LocalListingSchoolPremium[] {
  return (snapshot?.listingSchoolPremia ?? []).filter((p) => p.cityId === cityId);
}

/**
 * 小区商业热度 (v0.19.0+)
 */
export function getCommunityCommercials(): LocalCommunityCommercial[] {
  return snapshot?.communityCommercials ?? [];
}

export function getCommunityCommercialsByCity(cityId: number): LocalCommunityCommercial[] {
  return (snapshot?.communityCommercials ?? []).filter((c) => c.cityId === cityId);
}

/**
 * 通勤时长 (v0.24.0+)
 */
export function getCommutes(): LocalCommute[] {
  return snapshot?.commutes ?? [];
}

export function getCommutesByCity(cityId: number): LocalCommute[] {
  return (snapshot?.commutes ?? []).filter((c) => c.cityId === cityId);
}

export function getCommuteByCommunity(communityId: number): LocalCommute | null {
  return (snapshot?.commutes ?? []).find((c) => c.communityId === communityId) ?? null;
}

/**
 * v0.25.0: 户型/面积/朝向/装修分布 (全量 + 按城市过滤)
 */
export function getLayoutDistributions(): LocalLayoutDistribution[] {
  return snapshot?.layoutDistributions ?? [];
}

export function getLayoutDistributionsByCity(cityId: number): LocalLayoutDistribution[] {
  return (snapshot?.layoutDistributions ?? []).filter((l) => l.cityId === cityId);
}

/**
 * v0.28.0: 房源 tags (全量 + 按城市过滤)
 */
export function getListingTags(): LocalListingTag[] {
  return snapshot?.listingTags ?? [];
}

export function getListingTagsByCity(cityId: number): LocalListingTag[] {
  return (snapshot?.listingTags ?? []).filter((t) => t.cityId === cityId);
}

/**
 * 板块级周维度价格序列 (v0.8.0+)
 */
export function getDistrictTrends(): LocalDistrictTrend[] {
  return snapshot?.districtTrends ?? [];
}

/**
 * 给定城市 + 区，返回该区按 week_end 升序的价格序列。
 * 用于 dashboard "区级近 N 周趋势" 卡片。
 */
export function getDistrictTrendByDistrict(
  cityId: number,
  districtName: string
): LocalDistrictTrend[] {
  return (snapshot?.districtTrends ?? [])
    .filter((t) => t.cityId === cityId && t.districtName === districtName)
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
}

/**
 * 给定城市，返回该城市所有区按"最近一周 listing_count"排序的列表。
 */
export function getDistrictsByCity(cityId: number): string[] {
  const set = new Set<string>();
  for (const t of snapshot?.districtTrends ?? []) {
    if (t.cityId === cityId) set.add(t.districtName);
  }
  return [...set];
}

/**
 * 板块级周维度网签热度 (v0.10.0+)
 */
export function getWangqianDistrictWeekly(): LocalWangqianDistrictWeekly[] {
  return snapshot?.wangqianDistrictWeekly ?? [];
}

/**
 * 给定 cityName (如 "深圳") 和 category ("新房"/"二手")，
 * 返回按"近 N 周 totalUnits 求和"排序的区列表。
 */
export function getWangqianTopDistricts(params: {
  cityName: string;
  category?: "新房" | "二手";
  limit?: number;
  weeksBack?: number;
}): Array<{ district: string; totalUnits: number; totalAreaSqm: number; weeks: number }> {
  const { cityName, category, limit = 10, weeksBack = 4 } = params;
  const rows = (snapshot?.wangqianDistrictWeekly ?? []).filter(
    (r) => r.city === cityName && (category == null || r.category === category)
  );
  if (rows.length === 0) return [];
  // 最近 N 周 (按 weekEnd 降序取前 N)
  const sortedWeeks = [...new Set(rows.map((r) => r.weekEnd))].sort().reverse();
  const recentWeeks = new Set(sortedWeeks.slice(0, weeksBack));
  const agg = new Map<string, { units: number; area: number; weeks: Set<string> }>();
  for (const r of rows) {
    if (!recentWeeks.has(r.weekEnd)) continue;
    const cur = agg.get(r.district) ?? { units: 0, area: 0, weeks: new Set() };
    cur.units += r.totalUnits;
    cur.area += r.totalAreaSqm;
    cur.weeks.add(r.weekEnd);
    agg.set(r.district, cur);
  }
  return [...agg.entries()]
    .map(([district, v]) => ({
      district,
      totalUnits: v.units,
      totalAreaSqm: v.area,
      weeks: v.weeks.size
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, limit);
}

/**
 * 板块级学区溢价 (v0.11.0+)
 */
export function getSchoolPremiumDistricts(): LocalSchoolPremiumDistrict[] {
  return snapshot?.schoolPremiumDistricts ?? [];
}

/**
 * 给定 cityId，返回该城市各区按 premium_ratio 降序的学区溢价榜。
 * 过滤 school_count >= 1, listing_count >= 10 (避免样本不足)。
 */
export function getSchoolPremiumRank(params: {
  cityId: number;
  minListings?: number;
  limit?: number;
}): Array<{
  districtName: string;
  avgSchoolScore: number;
  schoolCount: number;
  listingCount: number;
  medianUnitPrice: number;
  premiumRatio: number;
  rank: number;
}> {
  const { cityId, minListings = 10, limit = 10 } = params;
  const rows = (snapshot?.schoolPremiumDistricts ?? []).filter(
    (r) => r.cityId === cityId && r.listingCount >= minListings
  );
  return rows
    .sort((a, b) => b.premiumRatio - a.premiumRatio)
    .slice(0, limit)
    .map((r, i) => ({
      districtName: r.districtName,
      avgSchoolScore: r.avgSchoolScore,
      schoolCount: r.schoolCount,
      listingCount: r.listingCount,
      medianUnitPrice: r.medianUnitPrice,
      premiumRatio: r.premiumRatio,
      rank: i + 1
    }));
}

/**
 * 小区级学区评分 (v0.11.0+)
 */
export function getSchoolPremiumCommunities(): LocalSchoolPremiumCommunity[] {
  return snapshot?.schoolPremiumCommunities ?? [];
}

/**
 * 给定 communityId 拿学校评分
 */
export function getCommunitySchoolScore(communityId: number): number {
  const c = (snapshot?.schoolPremiumCommunities ?? []).find(
    (x) => x.communityId === communityId
  );
  return c?.avgSchoolScore ?? 0;
}

/**
 * 给定 cityId，按 avg_school_score 降序返回 Top 小区。
 * 过滤 school_count >= 1, listing_count >= 1（避免空数据）。
 * 用于 dashboard "学区评分 Top 小区" 卡片。
 */
export type SchoolPremiumCommunitySort =
  | "avg_school_score" // 评分降序（默认）
  | "median_unit_price" // 均价升序（最便宜）
  | "listing_count" // 房源数降序（货量最大）
  | "school_count"; // 学校数降序

export function getSchoolPremiumCommunityRank(params: {
  cityId: number;
  /** v0.26.0: 可选过滤 + 排序 */
  minListings?: number;
  /** 最低学区评分 */
  minScore?: number;
  /** 限定区 (districtName); 多个用 | 分隔 */
  districtFilter?: string;
  /** 排序方式 (默认 avg_school_score) */
  sort?: SchoolPremiumCommunitySort;
  limit?: number;
}): Array<{
  communityId: number;
  districtName: string;
  communityName: string;
  schoolCount: number;
  avgSchoolScore: number;
  listingCount: number;
  medianUnitPrice: number;
  rank: number;
}> {
  const {
    cityId,
    minListings = 1,
    minScore = 0,
    districtFilter = "",
    sort = "avg_school_score",
    limit = 10
  } = params;
  const districts = new Set(
    districtFilter
      .split("|")
      .map((d) => d.trim())
      .filter(Boolean)
  );
  const rows = (snapshot?.schoolPremiumCommunities ?? []).filter(
    (c) =>
      c.cityId === cityId &&
      c.schoolCount >= 1 &&
      c.avgSchoolScore >= minScore &&
      c.listingCount >= minListings &&
      (districts.size === 0 || districts.has(c.districtName))
  );
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "median_unit_price":
        return a.medianUnitPrice - b.medianUnitPrice; // 便宜优先
      case "listing_count":
        return b.listingCount - a.listingCount;
      case "school_count":
        return b.schoolCount - a.schoolCount;
      case "avg_school_score":
      default:
        if (b.avgSchoolScore !== a.avgSchoolScore) {
          return b.avgSchoolScore - a.avgSchoolScore;
        }
        return b.medianUnitPrice - a.medianUnitPrice;
    }
  });
  return sorted
    .slice(0, limit)
    .map((c, i) => ({
      communityId: c.communityId,
      districtName: c.districtName,
      communityName: c.communityName,
      schoolCount: c.schoolCount,
      avgSchoolScore: c.avgSchoolScore,
      listingCount: c.listingCount,
      medianUnitPrice: c.medianUnitPrice,
      rank: i + 1
    }));
}

export function getAvailableWeeks(cityId?: number): { weekStartDate: string; weekEndDate: string }[] {
  if (!snapshot) return [];
  if (cityId == null) return snapshot.availableWeeks;
  const cityWeekEnds = new Set<string>();
  for (const l of snapshot.listings) {
    if (l.cityId !== cityId || !l.crawlDate) continue;
    cityWeekEnds.add(weekEndFromDate(l.crawlDate));
  }
  return snapshot.availableWeeks.filter((w) => cityWeekEnds.has(w.weekEndDate));
}

/**
 * 给定一个日期字符串（YYYY-MM-DD），返回它所在的 week_end（周日）。
 * 简化策略：取最近的周日（向过去回溯到周日）。
 */
export function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}