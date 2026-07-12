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
  LocalDailyWangqianRow,
  LocalDistrictTrend,
  LocalHospital,
  LocalListing,
  LocalMetroLine,
  LocalPoi,
  LocalSchool,
  LocalStats70Row
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