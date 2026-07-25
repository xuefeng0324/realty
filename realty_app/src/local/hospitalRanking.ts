/**
 * v1.108.0 派生：医院资源。
 *
 * 输入：snapshot.hospitals（LocalHospital[]，44 行 × 三城）。
 * 每行 = 1 家医院，含 cityId / districtName / hospitalType / hospitalLevel / lat / lng / keyFlag。
 * hospitalLevel: "三甲" | "三级" | "二甲" | "二级" | "其他" | null。
 *
 * 注意：本派生不消费 hospitals_geo.csv（hospitals_geo.csv 当前**未接入**，等接入后单独做 geo 派生）。
 *
 * 派生：
 *   - summarizeHospitalByCity: city 聚合（医院数 / 三甲数 / 三甲占比 / 各类医院数）
 *   - summarizeHospitalByCityDistrict: city × district 聚合
 *   - getHospitalTopByLevelByCity: 单 city 按 level 优先级排序 + 取 Top N
 *   - getHospitalByCityByType: 单 city 按 hospitalType 过滤（如"综合医院 / 中医 / 妇幼 / 儿童"）
 *   - getHospitalKeyFlagByCity: 单 city keyFlag=true 的重点医院
 *   - getHospitalByCityByDistrict: 单 city 单 district 全部医院
 *   - getHospitalCrossCityByDistrict: 跨城同名 district 对比（如"福田区"深圳 vs 广州）
 */

import { getHospitals } from "./store";
import type { LocalHospital } from "./types";

export type HospitalLevel = LocalHospital["hospitalLevel"];
export type HospitalType = string; // 类型不在 union，可任意字符串

/** level 优先级（数值越大越顶级） */
const LEVEL_RANK: Record<NonNullable<HospitalLevel>, number> = {
  三甲: 4,
  三级: 3,
  二甲: 2,
  二级: 1,
  其他: 0
};

export function levelRank(level: HospitalLevel | null): number {
  if (level == null) return -1;
  return LEVEL_RANK[level] ?? -1;
}

export interface CityHospitalSummary {
  cityId: number;
  hospitalCount: number;
  /** 三甲医院数 */
  sanJiaCount: number;
  /** 三甲占比 */
  sanJiaShare: number;
  /** 各类医院计数 */
  typeCounts: Record<string, number>;
  /** 该城 keyFlag=true 的重点医院数 */
  keyFlagCount: number;
}

export function summarizeHospitalByCity(): CityHospitalSummary[] {
  const all = getHospitals();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalHospital[]>();
  for (const h of all) {
    let arr = grouped.get(h.cityId);
    if (!arr) {
      arr = [];
      grouped.set(h.cityId, arr);
    }
    arr.push(h);
  }
  const out: CityHospitalSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const sanJia = arr.filter((h) => h.hospitalLevel === "三甲").length;
    const typeCounts: Record<string, number> = {};
    for (const h of arr) {
      const t = h.hospitalType ?? "未知";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    out.push({
      cityId,
      hospitalCount: arr.length,
      sanJiaCount: sanJia,
      sanJiaShare: sanJia / arr.length,
      typeCounts,
      keyFlagCount: arr.filter((h) => h.keyFlag === true).length
    });
  }
  out.sort((a, b) => b.sanJiaShare - a.sanJiaShare);
  return out;
}

export interface CityDistrictHospitalSummary {
  cityId: number;
  districtName: string;
  hospitalCount: number;
  sanJiaCount: number;
  /** 该 district 在 city 内的医院密度排名（1-based） */
  rankInCity: number;
}

export function summarizeHospitalByCityDistrict(
  cityId?: number
): CityDistrictHospitalSummary[] {
  const all = getHospitals();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((h) => h.cityId === cityId);
  const grouped = new Map<
    string,
    { cityId: number; districtName: string; arr: LocalHospital[] }
  >();
  for (const h of pool) {
    if (h.districtName == null) continue;
    const key = `${h.cityId}|${h.districtName}`;
    let cur = grouped.get(key);
    if (!cur) {
      cur = { cityId: h.cityId, districtName: h.districtName, arr: [] };
      grouped.set(key, cur);
    }
    cur.arr.push(h);
  }
  const out: CityDistrictHospitalSummary[] = [];
  for (const [, v] of grouped.entries()) {
    const sanJia = v.arr.filter((h) => h.hospitalLevel === "三甲").length;
    out.push({
      cityId: v.cityId,
      districtName: v.districtName,
      hospitalCount: v.arr.length,
      sanJiaCount: sanJia,
      rankInCity: 0
    });
  }
  out.sort((a, b) => b.hospitalCount - a.hospitalCount);
  out.forEach((d, i) => (d.rankInCity = i + 1));
  return out;
}

/** 单 city 按 level 优先级排序 + 取 Top N（先按 levelRank 倒序，再按 keyFlag 优先） */
export function getHospitalTopByLevelByCity(
  cityId: number | null,
  n: number = 5
): LocalHospital[] {
  const all = getHospitals();
  if (all.length === 0) return [];
  const pool = cityId == null ? all : all.filter((h) => h.cityId === cityId);
  return [...pool]
    .sort((a, b) => {
      const lr = levelRank(b.hospitalLevel) - levelRank(a.hospitalLevel);
      if (lr !== 0) return lr;
      // 同 level：keyFlag=true 优先
      const ak = a.keyFlag === true ? 1 : 0;
      const bk = b.keyFlag === true ? 1 : 0;
      return bk - ak;
    })
    .slice(0, n);
}

/** 单 city 单 hospitalType 过滤 */
export function getHospitalByCityByType(
  cityId: number,
  hospitalType: HospitalType
): LocalHospital[] {
  return getHospitals().filter(
    (h) => h.cityId === cityId && h.hospitalType === hospitalType
  );
}

/** 单 city keyFlag=true 重点医院 */
export function getHospitalKeyFlagByCity(
  cityId: number
): LocalHospital[] {
  return getHospitals().filter(
    (h) => h.cityId === cityId && h.keyFlag === true
  );
}

/** 单 city 单 district 全部医院（按 level 倒序） */
export function getHospitalByCityByDistrict(
  cityId: number,
  districtName: string
): LocalHospital[] {
  return getHospitals()
    .filter((h) => h.cityId === cityId && h.districtName === districtName)
    .sort((a, b) => levelRank(b.hospitalLevel) - levelRank(a.hospitalLevel));
}

/** 跨城同名 district 对比 */
export interface CrossCityHospitalEntry {
  cityId: number;
  districtName: string;
  hospitalCount: number;
  sanJiaCount: number;
}

export function getHospitalCrossCityByDistrict(
  districtName: string
): CrossCityHospitalEntry[] {
  const all = getHospitals().filter((h) => h.districtName === districtName);
  const grouped = new Map<number, { cityId: number; districtName: string; arr: LocalHospital[] }>();
  for (const h of all) {
    let cur = grouped.get(h.cityId);
    if (!cur) {
      cur = { cityId: h.cityId, districtName, arr: [] };
      grouped.set(h.cityId, cur);
    }
    cur.arr.push(h);
  }
  const out: CrossCityHospitalEntry[] = [];
  for (const [, v] of grouped.entries()) {
    const sanJia = v.arr.filter((h) => h.hospitalLevel === "三甲").length;
    out.push({
      cityId: v.cityId,
      districtName: v.districtName,
      hospitalCount: v.arr.length,
      sanJiaCount: sanJia
    });
  }
  out.sort((a, b) => b.hospitalCount - a.hospitalCount);
  return out;
}