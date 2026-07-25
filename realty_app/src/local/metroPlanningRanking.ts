/**
 * v1.110.0 派生：规划地铁线路（v0.15 既有数据源）。
 *
 * 输入：snapshot.metroLines（LocalMetroLine[]，21 行 × 三城 + 4 期）。
 * 每行：city / lineName / phase / status / length / stations / start-end /
 *       maxSpeed / openYearExpected / districts / notes
 *
 * status: "规划" / "在建" / "即将开通" / null
 * phase: "深圳四期" / "深圳五期" / "广州三期调整" / "广州四期" / "珠海规划"
 * openYearExpected: 2026~2030
 *
 * 派生：
 *   - summarizeMetroPlanningByCity: city 聚合（线路数 + 总里程 + 总站数 + 各 status 计数）
 *   - summarizeMetroPlanningByStatus: status 维度聚合（全国跨城）
 *   - summarizeMetroPlanningByOpenYear: 按开通年份聚合（"未来 5 年新增"时间线）
 *   - summarizeMetroPlanningByPhase: phase 维度聚合（每期规模）
 *   - getMetroPlanningByOpenYear: 某年开通的全部线路
 *   - getMetroPlanningByStatus: 某 status 全部线路（"即将开通"最容易落地区）
 *   - getMetroPlanningByCityTopByLength: 单 city 里程 Top N（"最长在建"）
 *   - getMetroPlanningByCityTopByStations: 单 city 站数 Top N
 *   - getMetroPlanningCrossCityByYear: 跨城同年开通线路对比
 *   - getMetroPlanningByCityFastLines: 跨城快线集合（≥100km/h）
 *   - getMetroPlanningByDistrict: 某区覆盖的线路（"南山区通几条地铁"）
 *   - getMetroPlanningByCityStatusVsStations: city × status → 站数总和
 *     （"广州 2027 即将开通" 等关键里程碑）
 */

import { getMetroLines } from "./store";
import type { LocalMetroLine } from "./types";

export interface CityMetroPlanningSummary {
  cityId: number;
  lineCount: number;
  totalLengthKm: number;
  totalStations: number;
  /** 4 status 分布 {status: count} */
  statusDistribution: Record<string, number>;
  avgMaxSpeedKmh: number; // 0 当 maxSpeed 全 null
}

export function summarizeMetroPlanningByCity(): CityMetroPlanningSummary[] {
  const all = getMetroLines();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalMetroLine[]>();
  for (const x of all) {
    let arr = grouped.get(x.cityId);
    if (!arr) {
      arr = [];
      grouped.set(x.cityId, arr);
    }
    arr.push(x);
  }
  const out: CityMetroPlanningSummary[] = [];
  for (const [cityId, arr] of grouped.entries()) {
    const status: Record<string, number> = {};
    let totalLength = 0;
    let totalStations = 0;
    const speedVals: number[] = [];
    for (const x of arr) {
      const s = x.status ?? "未知";
      status[s] = (status[s] ?? 0) + 1;
      totalLength += x.lengthKm ?? 0;
      totalStations += x.stationCount ?? 0;
      if (x.maxSpeedKmh != null) speedVals.push(x.maxSpeedKmh);
    }
    out.push({
      cityId,
      lineCount: arr.length,
      totalLengthKm: totalLength,
      totalStations,
      statusDistribution: status,
      avgMaxSpeedKmh:
        speedVals.length === 0
          ? 0
          : speedVals.reduce((s, v) => s + v, 0) / speedVals.length
    });
  }
  out.sort((a, b) => b.totalLengthKm - a.totalLengthKm);
  return out;
}

export interface StatusMetroPlanningSummary {
  status: string;
  lineCount: number;
  totalLengthKm: number;
  totalStations: number;
}

export function summarizeMetroPlanningByStatus(): StatusMetroPlanningSummary[] {
  const all = getMetroLines();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalMetroLine[]>();
  for (const x of all) {
    const key = x.status ?? "未知";
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(x);
  }
  const out: StatusMetroPlanningSummary[] = [];
  for (const [status, arr] of grouped.entries()) {
    out.push({
      status,
      lineCount: arr.length,
      totalLengthKm: arr.reduce((s, x) => s + (x.lengthKm ?? 0), 0),
      totalStations: arr.reduce((s, x) => s + (x.stationCount ?? 0), 0)
    });
  }
  out.sort((a, b) => b.totalLengthKm - a.totalLengthKm);
  return out;
}

export interface OpenYearMetroPlanningSummary {
  year: number;
  lineCount: number;
  totalLengthKm: number;
  totalStations: number;
}

export function summarizeMetroPlanningByOpenYear(): OpenYearMetroPlanningSummary[] {
  const all = getMetroLines();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalMetroLine[]>();
  for (const x of all) {
    if (x.openYearExpected == null) continue;
    let arr = grouped.get(x.openYearExpected);
    if (!arr) {
      arr = [];
      grouped.set(x.openYearExpected, arr);
    }
    arr.push(x);
  }
  const out: OpenYearMetroPlanningSummary[] = [];
  for (const [year, arr] of grouped.entries()) {
    out.push({
      year,
      lineCount: arr.length,
      totalLengthKm: arr.reduce((s, x) => s + (x.lengthKm ?? 0), 0),
      totalStations: arr.reduce((s, x) => s + (x.stationCount ?? 0), 0)
    });
  }
  out.sort((a, b) => a.year - b.year);
  return out;
}

export interface PhaseMetroPlanningSummary {
  phase: string;
  lineCount: number;
  totalLengthKm: number;
  totalStations: number;
}

export function summarizeMetroPlanningByPhase(): PhaseMetroPlanningSummary[] {
  const all = getMetroLines();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalMetroLine[]>();
  for (const x of all) {
    const key = x.phase ?? "未知";
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(x);
  }
  const out: PhaseMetroPlanningSummary[] = [];
  for (const [phase, arr] of grouped.entries()) {
    out.push({
      phase,
      lineCount: arr.length,
      totalLengthKm: arr.reduce((s, x) => s + (x.lengthKm ?? 0), 0),
      totalStations: arr.reduce((s, x) => s + (x.stationCount ?? 0), 0)
    });
  }
  out.sort((a, b) => b.totalLengthKm - a.totalLengthKm);
  return out;
}

/** 某年开通的全部线路 */
export function getMetroPlanningByOpenYear(
  year: number
): LocalMetroLine[] {
  return getMetroLines()
    .filter((x) => x.openYearExpected === year)
    .sort((a, b) => (b.lengthKm ?? 0) - (a.lengthKm ?? 0));
}

/** 某 status 全部线路 */
export function getMetroPlanningByStatus(
  status: LocalMetroLine["status"] | "未知"
): LocalMetroLine[] {
  return getMetroLines()
    .filter((x) => (x.status ?? "未知") === status)
    .sort((a, b) => (b.lengthKm ?? 0) - (a.lengthKm ?? 0));
}

export interface TopByMetric {
  cityId: number;
  lineName: string;
  lengthKm: number;
  stationCount: number;
  openYearExpected: number | null;
  status: string;
}

export function getMetroPlanningByCityTopByLength(
  cityId: number | null = null,
  n: number = 5
): TopByMetric[] {
  const all = getMetroLines();
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  return [...pool]
    .sort((a, b) => (b.lengthKm ?? 0) - (a.lengthKm ?? 0))
    .slice(0, n)
    .map((x) => ({
      cityId: x.cityId,
      lineName: x.lineName,
      lengthKm: x.lengthKm ?? 0,
      stationCount: x.stationCount ?? 0,
      openYearExpected: x.openYearExpected,
      status: x.status ?? "未知"
    }));
}

export function getMetroPlanningByCityTopByStations(
  cityId: number | null = null,
  n: number = 5
): TopByMetric[] {
  const all = getMetroLines();
  const pool = cityId == null ? all : all.filter((x) => x.cityId === cityId);
  return [...pool]
    .sort((a, b) => (b.stationCount ?? 0) - (a.stationCount ?? 0))
    .slice(0, n)
    .map((x) => ({
      cityId: x.cityId,
      lineName: x.lineName,
      lengthKm: x.lengthKm ?? 0,
      stationCount: x.stationCount ?? 0,
      openYearExpected: x.openYearExpected,
      status: x.status ?? "未知"
    }));
}

/** 跨城同年开通线路对比 */
export function getMetroPlanningCrossCityByYear(
  year: number
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const x of getMetroLines()) {
    if (x.openYearExpected !== year) continue;
    if (!out[x.cityId]) out[x.cityId] = [];
    out[x.cityId]!.push(x.lineName);
  }
  return out;
}

/** 跨城快线（≥100km/h）集合 */
export function getMetroPlanningByCityFastLines(
  minSpeed: number = 100
): LocalMetroLine[] {
  return getMetroLines()
    .filter((x) => x.maxSpeedKmh != null && x.maxSpeedKmh >= minSpeed)
    .sort((a, b) => (b.maxSpeedKmh ?? 0) - (a.maxSpeedKmh ?? 0));
}

/** 某区覆盖的线路 */
export function getMetroPlanningByDistrict(
  districtName: string,
  cityId: number | null = null
): LocalMetroLine[] {
  const all = getMetroLines().filter((x) => x.districts.includes(districtName));
  if (cityId == null) return all;
  return all.filter((x) => x.cityId === cityId);
}

/** city × status → 站数总和（"广州 2027 即将开通" 关键里程碑） */
export interface CityStatusStations {
  cityId: number;
  status: string;
  totalStations: number;
  lineCount: number;
}

export function getMetroPlanningByCityStatusVsStations(): CityStatusStations[] {
  const all = getMetroLines();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalMetroLine[]>();
  for (const x of all) {
    const key = `${x.cityId}|${x.status ?? "未知"}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(x);
  }
  const out: CityStatusStations[] = [];
  for (const [, arr] of grouped.entries()) {
    out.push({
      cityId: arr[0]!.cityId,
      status: arr[0]!.status ?? "未知",
      totalStations: arr.reduce((s, x) => s + (x.stationCount ?? 0), 0),
      lineCount: arr.length
    });
  }
  out.sort((a, b) => b.totalStations - a.totalStations);
  return out;
}