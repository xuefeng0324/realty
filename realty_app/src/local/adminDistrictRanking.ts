/**
 * v1.113.0 派生：行政区划基础数据（admin_districts.csv，v1.113 新接入）。
 *
 * 输入：snapshot.adminDistricts（LocalAdminDistrict[]，24 行 × 三城）。
 * 每行：cityId(1/2/3) + cityCode(4401/4403/4404 6 位) + districtCode(6 位) + districtName
 *
 * city_code 区段：
 *   4401 = 广州市（11 区）
 *   4403 = 深圳市（10 区/新区）
 *   4404 = 珠海市（3 区）
 *
 * district_code 6 位 = city_code(4) + 2 位区号；可通过末 2 位区分区类型（主城/郊区/新区/县级市撤区）
 *
 * 派生：
 *   - summarizeAdminDistrictByCity: city 聚合（区数 + city_code + 平均/最大/最小 districtCode 末 2 位）
 *   - getAdminDistrictByCityOrderedByCode: 单 city 按 districtCode 升序（行政区划官方顺序）
 *   - detectAdminDistrictCodeGaps: 检测 city 内 districtCode 是否连续（缺号提示行政区划调整）
 *   - summarizeAdminDistrictBySuffix: 按 districtCode 末 2 位（区号）聚合
 *   - getAdminDistrictByNameLike: 按区名模糊查询（"新区" / "区"）
 *   - classifyAdminDistrictSuffix: 末 2 位类型识别（主城 01-09 / 郊区 10-19 / 新区 20-49 / 县级市 50-79）
 *   - summarizeAdminDistrictBySuffixType: city × 类型 → 区数
 *   - getAdminDistrictByCityCrossReference: 与 metro_planning.districts 交叉验证
 *   - getAdminDistrictCrossCityByNameLike: 跨城同名区查询（"南山区"广州/深圳都有）
 */

import { getAdminDistricts, getMetroLines } from "./store";
import type { LocalAdminDistrict } from "./types";

const CITY_NAME_MAP: Record<number, string> = {
  1: "广州",
  2: "深圳",
  3: "珠海"
};

export function cityNameOf(cityId: number): string {
  return CITY_NAME_MAP[cityId] ?? `city-${cityId}`;
}

export interface CityAdminDistrictSummary {
  cityId: number;
  cityCode: string;
  districtCount: number;
  /** 末 2 位最小值 */
  minSuffix: number;
  /** 末 2 位最大值 */
  maxSuffix: number;
  /** 末 2 位平均值 */
  avgSuffix: number;
}

export function summarizeAdminDistrictByCity(): CityAdminDistrictSummary[] {
  const all = getAdminDistricts();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalAdminDistrict[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityAdminDistrictSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const suffixes = arr.map((x) => parseInt(x.districtCode.slice(-2), 10));
    out.push({
      cityId,
      cityCode: arr[0]!.cityCode,
      districtCount: arr.length,
      minSuffix: Math.min(...suffixes),
      maxSuffix: Math.max(...suffixes),
      avgSuffix: suffixes.reduce((s, v) => s + v, 0) / suffixes.length
    });
  }
  out.sort((a, b) => b.districtCount - a.districtCount);
  return out;
}

/** 单 city 按 districtCode 升序 */
export function getAdminDistrictByCityOrderedByCode(
  cityId: number
): LocalAdminDistrict[] {
  return getAdminDistricts()
    .filter((x) => x.cityId === cityId)
    .sort((a, b) => a.districtCode.localeCompare(b.districtCode));
}

export interface AdminDistrictCodeGap {
  cityId: number;
  /** 缺失的末 2 位区号列表（区间内整数） */
  missingSuffixes: number[];
  /** 区间长度（max - min + 1） */
  rangeLength: number;
  /** 实际区数 */
  actualCount: number;
  /** 末 2 位最小值 */
  minSuffix: number;
  /** 末 2 位最大值 */
  maxSuffix: number;
  /** 是否连续（无缺号） */
  isContiguous: boolean;
}

/** 检测 city 内 districtCode 是否连续（缺号提示行政区划调整） */
export function detectAdminDistrictCodeGaps(
  cityId: number
): AdminDistrictCodeGap {
  const all = getAdminDistricts().filter((x) => x.cityId === cityId);
  if (all.length === 0) {
    return {
      cityId,
      missingSuffixes: [],
      rangeLength: 0,
      actualCount: 0,
      minSuffix: 0,
      maxSuffix: 0,
      isContiguous: true
    };
  }
  const suffixes = all
    .map((x) => parseInt(x.districtCode.slice(-2), 10))
    .sort((a, b) => a - b);
  const min = suffixes[0]!;
  const max = suffixes[suffixes.length - 1]!;
  const set = new Set(suffixes);
  const missing: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!set.has(i)) missing.push(i);
  }
  return {
    cityId,
    missingSuffixes: missing,
    rangeLength: max - min + 1,
    actualCount: suffixes.length,
    minSuffix: min,
    maxSuffix: max,
    isContiguous: missing.length === 0
  };
}

/** 按 districtCode 末 2 位聚合（哪些区号被哪些城市用） */
export interface SuffixUsage {
  suffix: number;
  cities: number[];
  cityNames: string[];
  /** "cityName-districtName" 列表 */
  districtNames: string[];
}

export function summarizeAdminDistrictBySuffix(): SuffixUsage[] {
  const all = getAdminDistricts();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalAdminDistrict[]>();
  for (const x of all) {
    const sfx = parseInt(x.districtCode.slice(-2), 10);
    let arr = grouped.get(sfx);
    if (!arr) {
      arr = [];
      grouped.set(sfx, arr);
    }
    arr.push(x);
  }
  const out: SuffixUsage[] = [];
  for (const [suffix, arr] of grouped.entries()) {
    out.push({
      suffix,
      cities: Array.from(new Set(arr.map((x) => x.cityId))),
      cityNames: Array.from(new Set(arr.map((x) => cityNameOf(x.cityId)))),
      districtNames: arr.map((x) => `${cityNameOf(x.cityId)}-${x.districtName}`)
    });
  }
  out.sort((a, b) => a.suffix - b.suffix);
  return out;
}

/** 按区名模糊查询（"新区" / "区"） */
export function getAdminDistrictByNameLike(
  keyword: string
): LocalAdminDistrict[] {
  return getAdminDistricts()
    .filter((x) => x.districtName.includes(keyword))
    .sort(
      (a, b) =>
        a.cityId - b.cityId || a.districtCode.localeCompare(b.districtCode)
    );
}

export type AdminDistrictSuffixType =
  | "主城" // 01-09
  | "郊区" // 10-19
  | "新区" // 20-49
  | "县级市撤区"; // 50-79

/** 末 2 位类型识别 */
export function classifyAdminDistrictSuffix(
  suffix: number
): AdminDistrictSuffixType {
  if (suffix <= 9) return "主城";
  if (suffix <= 19) return "郊区";
  if (suffix <= 49) return "新区";
  return "县级市撤区";
}

/** city × 类型 → 区数 */
export interface CitySuffixTypeCount {
  cityId: number;
  type: AdminDistrictSuffixType;
  count: number;
}

export function summarizeAdminDistrictBySuffixType(): CitySuffixTypeCount[] {
  const all = getAdminDistricts();
  if (all.length === 0) return [];
  const grouped = new Map<string, number>();
  for (const x of all) {
    const sfx = parseInt(x.districtCode.slice(-2), 10);
    const type = classifyAdminDistrictSuffix(sfx);
    const key = `${x.cityId}|${type}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  const out: CitySuffixTypeCount[] = [];
  for (const [key, count] of grouped.entries()) {
    const [cityIdStr, type] = key.split("|");
    out.push({
      cityId: Number(cityIdStr),
      type: type as AdminDistrictSuffixType,
      count
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** 与 metro_planning.districts 交叉验证：
 *  - 行政区登记中区名 vs 规划地铁覆盖区名
 *  - 返回：{inBoth, onlyAdmin, onlyMetro}
 */
export interface AdminMetroCrossRef {
  cityId: number;
  inBoth: string[];
  onlyAdmin: string[];
  onlyMetro: string[];
}

export function getAdminDistrictByCityCrossReference(
  cityId: number
): AdminMetroCrossRef {
  const adminDistricts = new Set(
    getAdminDistricts()
      .filter((x) => x.cityId === cityId)
      .map((x) => x.districtName)
  );
  const metroDistricts = new Set<string>();
  for (const m of getMetroLines().filter((x) => x.cityId === cityId)) {
    for (const d of m.districts) metroDistricts.add(d);
  }
  const inBoth: string[] = [];
  const onlyAdmin: string[] = [];
  for (const d of adminDistricts) {
    if (metroDistricts.has(d)) inBoth.push(d);
    else onlyAdmin.push(d);
  }
  const onlyMetro: string[] = [];
  for (const d of metroDistricts) {
    if (!adminDistricts.has(d)) onlyMetro.push(d);
  }
  return { cityId, inBoth, onlyAdmin, onlyMetro };
}

/** 跨城同名区（"南山区" 广州/深圳都有） */
export function getAdminDistrictCrossCityByNameLike(
  keyword: string
): LocalAdminDistrict[] {
  return getAdminDistricts()
    .filter((x) => x.districtName.includes(keyword))
    .sort((a, b) => a.cityId - b.cityId);
}