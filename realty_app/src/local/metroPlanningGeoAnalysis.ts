/**
 * v1.114.0 派生：规划地铁站点坐标（v0.15 既有数据源 metro_planning_geo.csv）。
 *
 * 输入：snapshot.metroLineGeos（LocalMetroLineGeo[]，21 行 × 三城）。
 * 每行：lineId + cityId + 起终点名称 + lat/lng + confidence（high/medium/low/manual/missing）。
 *
 * 派生：
 *   - summarizeMetroPlanningGeoByCity: city 聚合（站点对数 + 各 confidence 分布 + 平均/最大直线距离）
 *   - summarizeMetroPlanningGeoByConfidence: confidence 维度（全国跨城）
 *   - getMetroPlanningGeoByConfidence: 某 confidence 全部（"manual 兜底了多少"）
 *   - getMetroPlanningGeoByCityStraightLineTop: 单 city 起终点直线距离 Top N（最长规划线路）
 *   - getMetroPlanningGeoByCityStartEnd: 单 city 起终点名 + 坐标 + 直距
 *   - getMetroPlanningGeoCrossCityByConfidence: 跨城同 confidence 对比（"high 城市间覆盖度"）
 *   - getMetroPlanningGeoManualFallbackRate: 跨城 manual 占比（"数据完整性"指标）
 *   - getMetroPlanningGeoByCityCrossReference: 与 metro_planning 按 lineId 对齐 → 直线 vs 实际里程
 *     （实际里程 ÷ 直线距离 = 弯曲系数；1.0=直线，>1.3=严重弯曲）
 *   - getMetroPlanningGeoByCityMissingEndpoints: 缺坐标的起/终点（confidence=missing 或 null）
 *   - getMetroPlanningGeoCoverageStats: 全国站点坐标覆盖率（端点坐标完整 %）
 */

import { getMetroLineGeos, getMetroLines } from "./store";
import type { LocalMetroLineGeo } from "./types";

export type ConfidenceLevel =
  | "high"
  | "medium"
  | "low"
  | "manual"
  | "missing";

const EARTH_RADIUS_KM = 6371;

/** 直线距离 km（Haversine 公式） */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 直线距离 m（端点都非 null 才计算） */
export function straightLineMeters(g: LocalMetroLineGeo): number | null {
  if (g.startLat == null || g.startLng == null) return null;
  if (g.endLat == null || g.endLng == null) return null;
  return Math.round(haversineKm(g.startLat, g.startLng, g.endLat, g.endLng) * 1000);
}

export interface CityMetroPlanningGeoSummary {
  cityId: number;
  lineCount: number;
  /** {high: count, medium: count, low: count, manual: count, missing: count} */
  startConfidence: Record<ConfidenceLevel, number>;
  endConfidence: Record<ConfidenceLevel, number>;
  /** 直线距离平均 km（仅含端点坐标齐全的线路） */
  avgStraightLineKm: number;
  /** 直线距离最大 km */
  maxStraightLineKm: number;
}

function emptyConfidence(): Record<ConfidenceLevel, number> {
  return { high: 0, medium: 0, low: 0, manual: 0, missing: 0 };
}

export function summarizeMetroPlanningGeoByCity(): CityMetroPlanningGeoSummary[] {
  const all = getMetroLineGeos();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalMetroLineGeo[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityMetroPlanningGeoSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const startConf = emptyConfidence();
    const endConf = emptyConfidence();
    const distances: number[] = [];
    for (const x of arr) {
      startConf[x.startConfidence]++;
      endConf[x.endConfidence]++;
      const d = straightLineMeters(x);
      if (d != null) distances.push(d / 1000);
    }
    out.push({
      cityId,
      lineCount: arr.length,
      startConfidence: startConf,
      endConfidence: endConf,
      avgStraightLineKm:
        distances.length === 0
          ? 0
          : distances.reduce((s, v) => s + v, 0) / distances.length,
      maxStraightLineKm:
        distances.length === 0 ? 0 : Math.max(...distances)
    });
  }
  out.sort((a, b) => b.lineCount - a.lineCount);
  return out;
}

export interface ConfidenceLevelSummary {
  level: ConfidenceLevel;
  count: number;
  /** 涉及 city 数 */
  cityCount: number;
  /** 涉及线路名集合（前 5） */
  topLineNames: string[];
}

export function summarizeMetroPlanningGeoByConfidence(): ConfidenceLevelSummary[] {
  const all = getMetroLineGeos();
  if (all.length === 0) return [];
  const startMap = new Map<ConfidenceLevel, LocalMetroLineGeo[]>();
  const endMap = new Map<ConfidenceLevel, LocalMetroLineGeo[]>();
  for (const x of all) {
    let a = startMap.get(x.startConfidence);
    if (!a) {
      a = [];
      startMap.set(x.startConfidence, a);
    }
    a.push(x);
    let b = endMap.get(x.endConfidence);
    if (!b) {
      b = [];
      endMap.set(x.endConfidence, b);
    }
    b.push(x);
  }
  const out: ConfidenceLevelSummary[] = [];
  for (const level of ["high", "medium", "low", "manual", "missing"] as const) {
    const startSubset = startMap.get(level) ?? [];
    const endSubset = endMap.get(level) ?? [];
    // 合并（取并集 by lineId）
    const merged = new Map<number, LocalMetroLineGeo>();
    for (const x of [...startSubset, ...endSubset]) merged.set(x.lineId, x);
    const arr = Array.from(merged.values());
    if (arr.length === 0) continue;
    out.push({
      level,
      count: arr.length,
      cityCount: new Set(arr.map((x) => x.cityId)).size,
      topLineNames: arr.slice(0, 5).map((x) => x.lineName)
    });
  }
  return out;
}

/** 某 confidence 全部线路（起或终至少一端为该 confidence） */
export function getMetroPlanningGeoByConfidence(
  level: ConfidenceLevel
): LocalMetroLineGeo[] {
  return getMetroLineGeos()
    .filter(
      (x) => x.startConfidence === level || x.endConfidence === level
    )
    .sort((a, b) => b.lineId - a.lineId);
}

/** 单 city 起终点直线距离 Top N（最长规划） */
export interface StraightLineTop {
  lineId: number;
  lineName: string;
  cityId: number;
  straightLineKm: number;
  startStation: string;
  endStation: string;
}

export function getMetroPlanningGeoByCityStraightLineTop(
  cityId: number | null = null,
  n: number = 5
): StraightLineTop[] {
  const all = getMetroLineGeos();
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  const enriched = pool
    .map((x) => ({
      x,
      d: straightLineMeters(x)
    }))
    .filter((e): e is { x: LocalMetroLineGeo; d: number } => e.d != null);
  return enriched
    .sort((a, b) => b.d - a.d)
    .slice(0, n)
    .map((e) => ({
      lineId: e.x.lineId,
      lineName: e.x.lineName,
      cityId: e.x.cityId,
      straightLineKm: e.d / 1000,
      startStation: e.x.startStation,
      endStation: e.x.endStation
    }));
}

/** 单 city 起终点坐标 + 直距（按 lineId 升序） */
export function getMetroPlanningGeoByCityStartEnd(
  cityId: number
): (LocalMetroLineGeo & { straightLineM: number | null })[] {
  return getMetroLineGeos()
    .filter((x) => x.cityId === cityId)
    .sort((a, b) => a.lineId - b.lineId)
    .map((x) => ({ ...x, straightLineM: straightLineMeters(x) }));
}

/** 跨城同 confidence 对比 */
export function getMetroPlanningGeoCrossCityByConfidence(
  level: ConfidenceLevel
): { cityId: number; lineCount: number }[] {
  const subset = getMetroPlanningGeoByConfidence(level);
  const grouped = new Map<number, number>();
  for (const x of subset) {
    grouped.set(x.cityId, (grouped.get(x.cityId) ?? 0) + 1);
  }
  return Array.from(grouped.entries())
    .map(([cityId, lineCount]) => ({ cityId, lineCount }))
    .sort((a, b) => b.lineCount - a.lineCount);
}

/** 跨城 manual 占比（数据完整性指标） */
export interface ManualFallbackRate {
  cityId: number;
  totalLines: number;
  manualLines: number;
  manualRatio: number;
}

export function getMetroPlanningGeoManualFallbackRate(): ManualFallbackRate[] {
  const all = getMetroLineGeos();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalMetroLineGeo[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: ManualFallbackRate[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const manual = arr.filter(
      (x) =>
        x.startConfidence === "manual" || x.endConfidence === "manual"
    ).length;
    out.push({
      cityId,
      totalLines: arr.length,
      manualLines: manual,
      manualRatio: arr.length === 0 ? 0 : manual / arr.length
    });
  }
  out.sort((a, b) => b.manualRatio - a.manualRatio);
  return out;
}

/** 与 metro_planning 按 lineId 对齐 → 直线 vs 实际里程 */
export interface CurvatureEntry {
  lineId: number;
  lineName: string;
  cityId: number;
  straightLineKm: number;
  actualLengthKm: number | null;
  /** actual / straight；>=1.3 算弯曲 */
  curvatureRatio: number | null;
}

export function getMetroPlanningGeoByCityCrossReference(): CurvatureEntry[] {
  const geos = getMetroLineGeos();
  const lines = new Map(
    getMetroLines().map((x) => [x.lineId, x] as const)
  );
  const out: CurvatureEntry[] = [];
  for (const g of geos) {
    const line = lines.get(g.lineId);
    const straightKm = (straightLineMeters(g) ?? 0) / 1000;
    const actualKm = line?.lengthKm ?? null;
    let ratio: number | null = null;
    if (actualKm != null && straightKm > 0) {
      ratio = Math.round((actualKm / straightKm) * 100) / 100;
    }
    out.push({
      lineId: g.lineId,
      lineName: g.lineName,
      cityId: g.cityId,
      straightLineKm:
        Math.round(straightKm * 100) / 100,
      actualLengthKm: actualKm,
      curvatureRatio: ratio
    });
  }
  out.sort((a, b) => (b.curvatureRatio ?? 0) - (a.curvatureRatio ?? 0));
  return out;
}

/** 缺坐标的起/终点（confidence=missing 或 lat/lng=null） */
export function getMetroPlanningGeoByCityMissingEndpoints(
  cityId: number | null = null
): LocalMetroLineGeo[] {
  const all = getMetroLineGeos();
  const subset =
    cityId == null ? all : all.filter((x) => x.cityId === cityId);
  return subset
    .filter(
      (x) =>
        x.startConfidence === "missing" ||
        x.endConfidence === "missing" ||
        x.startLat == null ||
        x.endLat == null
    )
    .sort((a, b) => a.cityId - b.cityId || a.lineId - b.lineId);
}

/** 全国站点坐标覆盖率（端点坐标完整 %） */
export interface CoverageStats {
  totalEndpoints: number; // 总端点数（lines × 2）
  completeEndpoints: number; // 完整端点数（lat/lng 都非 null 且 confidence ≠ missing）
  coverageRatio: number;
}

export function getMetroPlanningGeoCoverageStats(): CoverageStats {
  const all = getMetroLineGeos();
  let total = 0;
  let complete = 0;
  for (const x of all) {
    total += 2;
    if (x.startLat != null && x.startConfidence !== "missing") complete++;
    if (x.endLat != null && x.endConfidence !== "missing") complete++;
  }
  return {
    totalEndpoints: total,
    completeEndpoints: complete,
    coverageRatio: total === 0 ? 0 : complete / total
  };
}