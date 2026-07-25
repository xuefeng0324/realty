/**
 * v1.115.0 派生：医院坐标数据（hospitals_geo.csv，v1.115 新接入）。
 *
 * 输入：snapshot.hospitalGeos（LocalHospitalGeo[]，50 行 × 三城）+ snapshot.hospitals
 *      （用于 cityId 映射：LocalHospital.hospitalId → cityId）
 *
 * 每行：hospitalId + lat/lng + amapPoiId + formattedAddress + confidence(4 等级)
 *      + source(amap_text) + distanceM
 *
 * 注意：hospitalId 6 和 20 是同一医院（深圳市儿童医院，amapPoiId=B02F3006F6 重复）
 *      → 派生层不主动合并，按原始数据展示
 *
 * 派生：
 *   - haversineKm: 复用 v1.114 直线距离工具
 *   - summarizeHospitalGeoByCity: city 聚合（医院数 + confidence 分布 + 重复 amapPoiId 数）
 *   - summarizeHospitalGeoByConfidence: confidence 维度（全国）
 *   - getHospitalGeoByCityByConfidence: 某 city 某 confidence 全部医院
 *   - getHospitalGeoByCityNearestPair: 同 city 两点直线最近 Top（"市内最近两医院"）
 *   - getHospitalGeoCrossCityByCityPairDistance: 跨城 hospital 对直线距离
 *     （"广州医院到深圳医院"距离量级）
 *   - getHospitalGeoByCityWithinRadius: city 内距某点 ≤ X km 的医院数（急救覆盖）
 *   - detectHospitalGeoDuplicateAmapPoi: 重复 amapPoiId 检测（"同医院被记两次"）
 *   - getHospitalGeoByCityAddressDistrict: city 内按 formatted_address 行政区划聚合
 *   - getHospitalGeoByCityHighConfidenceRatio: city 高 confidence 占比（数据质量指标）
 *   - getHospitalGeoCoverageStats: 全国坐标覆盖率（lat/lng 非 null）
 */

import {
  getHospitalGeos,
  getHospitals
} from "./store";
import { haversineKm } from "./metroPlanningGeoAnalysis";
import type {
  LocalHospital,
  LocalHospitalGeo
} from "./types";

export type HospitalGeoConfidence = "high" | "medium" | "low" | "missing";

export interface CityHospitalGeoSummary {
  cityId: number;
  /** 该 city 的医院坐标数（不去重） */
  geoCount: number;
  /** unique amapPoiId 数（去重） */
  uniquePoiCount: number;
  /** confidence 分布 {high: count, medium: count, low: count, missing: count} */
  confidence: Record<HospitalGeoConfidence, number>;
  /** 平均 distance_m（null 端点跳过） */
  avgDistanceM: number;
  /** 高德重复 amapPoiId 数（同 city 内重复） */
  duplicatePoiCount: number;
}

function emptyConfidence(): Record<HospitalGeoConfidence, number> {
  return { high: 0, medium: 0, low: 0, missing: 0 };
}

/** hospitalId → cityId 映射（用 LocalHospital） */
function buildCityMap(): Map<number, number> {
  const m = new Map<number, number>();
  for (const h of getHospitals()) m.set(h.hospitalId, h.cityId);
  return m;
}

export function summarizeHospitalGeoByCity(): CityHospitalGeoSummary[] {
  const all = getHospitalGeos();
  if (all.length === 0) return [];
  const cityMap = buildCityMap();
  const grouped = new Map<number, LocalHospitalGeo[]>();
  for (const x of all) {
    const cid = cityMap.get(x.hospitalId);
    if (cid == null) continue;
    let arr = grouped.get(cid);
    if (!arr) {
      arr = [];
      grouped.set(cid, arr);
    }
    arr.push(x);
  }
  const out: CityHospitalGeoSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const conf = emptyConfidence();
    const distances: number[] = [];
    const poiIds = new Set<string>();
    const poiCount = new Map<string, number>();
    for (const x of arr) {
      conf[x.confidence]++;
      if (x.distanceM != null) distances.push(x.distanceM);
      poiIds.add(x.amapPoiId);
      if (x.amapPoiId) {
        poiCount.set(x.amapPoiId, (poiCount.get(x.amapPoiId) ?? 0) + 1);
      }
    }
    const duplicate = Array.from(poiCount.values()).filter(
      (c) => c > 1
    ).length;
    out.push({
      cityId,
      geoCount: arr.length,
      uniquePoiCount: poiIds.size,
      confidence: conf,
      avgDistanceM:
        distances.length === 0
          ? 0
          : distances.reduce((s, d) => s + d, 0) / distances.length,
      duplicatePoiCount: duplicate
    });
  }
  out.sort((a, b) => b.geoCount - a.geoCount);
  return out;
}

export interface HospitalGeoConfidenceSummary {
  level: HospitalGeoConfidence;
  count: number;
  cityCount: number;
  hospitalIds: number[];
}

export function summarizeHospitalGeoByConfidence(): HospitalGeoConfidenceSummary[] {
  const all = getHospitalGeos();
  if (all.length === 0) return [];
  const grouped = new Map<HospitalGeoConfidence, LocalHospitalGeo[]>();
  for (const x of all) {
    let arr = grouped.get(x.confidence);
    if (!arr) {
      arr = [];
      grouped.set(x.confidence, arr);
    }
    arr.push(x);
  }
  const out: HospitalGeoConfidenceSummary[] = [];
  for (const [level, arr] of grouped.entries()) {
    out.push({
      level,
      count: arr.length,
      cityCount: new Set(
        arr.map((x) => buildCityMap().get(x.hospitalId))
      ).size,
      hospitalIds: arr.map((x) => x.hospitalId)
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** 某 city 某 confidence 全部医院坐标 */
export function getHospitalGeoByCityByConfidence(
  cityId: number,
  confidence: HospitalGeoConfidence
): LocalHospitalGeo[] {
  const cityMap = buildCityMap();
  return getHospitalGeos()
    .filter(
      (x) =>
        cityMap.get(x.hospitalId) === cityId && x.confidence === confidence
    )
    .sort((a, b) => a.hospitalId - b.hospitalId);
}

export interface HospitalGeoNearestPair {
  cityId: number;
  hospitalIdA: number;
  hospitalIdB: number;
  distanceKm: number;
}

/** 同 city 两点直线最近 Top（市内最近两医院） */
export function getHospitalGeoByCityNearestPair(
  cityId: number,
  n: number = 5
): HospitalGeoNearestPair[] {
  const cityMap = buildCityMap();
  const subset = getHospitalGeos().filter(
    (x) =>
      cityMap.get(x.hospitalId) === cityId &&
      x.lat != null &&
      x.lng != null
  );
  const pairs: HospitalGeoNearestPair[] = [];
  for (let i = 0; i < subset.length; i++) {
    for (let j = i + 1; j < subset.length; j++) {
      const a = subset[i]!;
      const b = subset[j]!;
      const d = haversineKm(a.lat!, a.lng!, b.lat!, b.lng!);
      pairs.push({
        cityId,
        hospitalIdA: a.hospitalId,
        hospitalIdB: b.hospitalId,
        distanceKm: Math.round(d * 100) / 100
      });
    }
  }
  pairs.sort((a, b) => a.distanceKm - b.distanceKm);
  return pairs.slice(0, n);
}

/** 跨城 hospital 对直线距离（"广州医院到深圳医院"距离） */
export interface CrossCityHospitalDistance {
  cityIdA: number;
  cityIdB: number;
  hospitalIdA: number;
  hospitalIdB: number;
  distanceKm: number;
}

export function getHospitalGeoCrossCityByCityPairDistance(
  n: number = 5
): CrossCityHospitalDistance[] {
  const cityMap = buildCityMap();
  const valid = getHospitalGeos().filter(
    (x) =>
      x.lat != null && x.lng != null && cityMap.has(x.hospitalId)
  );
  const cityGroups = new Map<number, LocalHospitalGeo[]>();
  for (const x of valid) {
    const cid = cityMap.get(x.hospitalId)!;
    let arr = cityGroups.get(cid);
    if (!arr) {
      arr = [];
      cityGroups.set(cid, arr);
    }
    arr.push(x);
  }
  const cityIds = Array.from(cityGroups.keys()).sort((a, b) => a - b);
  const pairs: CrossCityHospitalDistance[] = [];
  for (let i = 0; i < cityIds.length; i++) {
    for (let j = i + 1; j < cityIds.length; j++) {
      const cA = cityIds[i]!;
      const cB = cityIds[j]!;
      const aArr = cityGroups.get(cA)!;
      const bArr = cityGroups.get(cB)!;
      // 取两城之间的最短一对（贪心：取每城任意一点，对所有点求最短）
      let best = Number.POSITIVE_INFINITY;
      let bestA: LocalHospitalGeo | null = null;
      let bestB: LocalHospitalGeo | null = null;
      for (const a of aArr) {
        for (const b of bArr) {
          const d = haversineKm(a.lat!, a.lng!, b.lat!, b.lng!);
          if (d < best) {
            best = d;
            bestA = a;
            bestB = b;
          }
        }
      }
      if (bestA && bestB) {
        pairs.push({
          cityIdA: cA,
          cityIdB: cB,
          hospitalIdA: bestA.hospitalId,
          hospitalIdB: bestB.hospitalId,
          distanceKm: Math.round(best * 100) / 100
        });
      }
    }
  }
  pairs.sort((a, b) => a.distanceKm - b.distanceKm);
  return pairs.slice(0, n);
}

/** city 内距某点 ≤ X km 的医院数（急救覆盖：传入参考点 lat/lng） */
export interface HospitalGeoWithinRadius {
  cityId: number;
  refLat: number;
  refLng: number;
  radiusKm: number;
  withinCount: number;
  /** 覆盖到的医院列表（按距离升序） */
  hospitalIds: number[];
}

export function getHospitalGeoByCityWithinRadius(
  cityId: number,
  refLat: number,
  refLng: number,
  radiusKm: number
): HospitalGeoWithinRadius {
  const cityMap = buildCityMap();
  const subset = getHospitalGeos().filter(
    (x) =>
      cityMap.get(x.hospitalId) === cityId &&
      x.lat != null &&
      x.lng != null
  );
  const within: { id: number; d: number }[] = [];
  for (const x of subset) {
    const d = haversineKm(refLat, refLng, x.lat!, x.lng!);
    if (d <= radiusKm) within.push({ id: x.hospitalId, d });
  }
  within.sort((a, b) => a.d - b.d);
  return {
    cityId,
    refLat,
    refLng,
    radiusKm,
    withinCount: within.length,
    hospitalIds: within.map((x) => x.id)
  };
}

export interface HospitalGeoDuplicate {
  amapPoiId: string;
  hospitalIds: number[];
  count: number;
}

/** 检测重复 amapPoiId（同医院被记多次） */
export function detectHospitalGeoDuplicateAmapPoi(): HospitalGeoDuplicate[] {
  const all = getHospitalGeos();
  if (all.length === 0) return [];
  const m = new Map<string, number[]>();
  for (const x of all) {
    if (!x.amapPoiId) continue;
    let arr = m.get(x.amapPoiId);
    if (!arr) {
      arr = [];
      m.set(x.amapPoiId, arr);
    }
    arr.push(x.hospitalId);
  }
  const out: HospitalGeoDuplicate[] = [];
  for (const [poiId, ids] of m.entries()) {
    if (ids.length > 1) {
      out.push({
        amapPoiId: poiId,
        hospitalIds: [...ids].sort((a, b) => a - b),
        count: ids.length
      });
    }
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** city 内按 formatted_address 行政区划聚合（从地址字符串提取"区/县"） */
export interface HospitalGeoDistrictSummary {
  cityId: number;
  /** 行政区划名（如"福田区"） */
  districtName: string;
  count: number;
}

export function getHospitalGeoByCityAddressDistrict(
  cityId: number
): HospitalGeoDistrictSummary[] {
  const cityMap = buildCityMap();
  const subset = getHospitalGeos().filter(
    (x) => cityMap.get(x.hospitalId) === cityId
  );
  const m = new Map<string, number>();
  // 地址格式 "广东省深圳市福田区莲花街道..."
  for (const x of subset) {
    const match = x.formattedAddress.match(
      /(?:省|市)(?:[^省]+市)?([^区]+?[区县])/
    );
    const district = match?.[1] ?? "未知";
    m.set(district, (m.get(district) ?? 0) + 1);
  }
  const out: HospitalGeoDistrictSummary[] = [];
  for (const [districtName, count] of m.entries()) {
    out.push({ cityId, districtName, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** city 高 confidence 占比（数据质量指标） */
export interface HospitalGeoHighConfidenceRatio {
  cityId: number;
  total: number;
  highConfidence: number;
  ratio: number;
}

export function getHospitalGeoByCityHighConfidenceRatio(): HospitalGeoHighConfidenceRatio[] {
  const summary = summarizeHospitalGeoByCity();
  return summary.map((s) => ({
    cityId: s.cityId,
    total: s.geoCount,
    highConfidence: s.confidence.high,
    ratio: s.geoCount === 0 ? 0 : s.confidence.high / s.geoCount
  }));
}

/** 全国坐标覆盖率（lat/lng 非 null） */
export interface HospitalGeoCoverageStats {
  total: number;
  withCoords: number;
  coverageRatio: number;
}

export function getHospitalGeoCoverageStats(): HospitalGeoCoverageStats {
  const all = getHospitalGeos();
  let withCoords = 0;
  for (const x of all) {
    if (x.lat != null && x.lng != null) withCoords++;
  }
  return {
    total: all.length,
    withCoords,
    coverageRatio: all.length === 0 ? 0 : withCoords / all.length
  };
}