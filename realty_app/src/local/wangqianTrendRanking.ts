/**
 * v1.102.0 派生：网签周数据的趋势指标。
 *
 * 输入：snapshot.wangqianDistrictWeekly（LocalWangqianDistrictWeekly[]，60+ 行）。
 * 每行代表某 city × district × category × weekEnd 的周度数据。
 *
 * 派生：
 *   - summarizeWangqianWeeklyByDistrict: 按 (city, district, category) 聚合（周数 / 累计 units / 平均日 units）
 *   - getWangqianWeeklyWoWChange: 周环比 WoW（最近两周 units 之比），取 Top 升 + Top 降
 *   - getWangqianWeeklyVolatility: 按 (city, district, category) 算 weekly units 的变异系数
 *   - getWangqianWeeklyRecentSpikes: 检测"最新一周较前 4 周平均"突增 N 倍的区
 *   - getWangqianWeeklyByCityCategoryTrend: 按 (city, category) 算整市周维度 trend（最近一周 vs 前 N 周）
 */

import { getWangqianDistrictWeekly } from "./store";
import type { LocalWangqianDistrictWeekly } from "./types";

export interface DistrictWeeklySummary {
  city: string;
  district: string;
  category: LocalWangqianDistrictWeekly["category"];
  weekCount: number;
  totalUnits: number;
  avgDailyUnits: number;
  /** 最近一周 units */
  latestUnits: number | null;
  /** 最近一周 weekEnd（YYYY-MM-DD） */
  latestWeekEnd: string | null;
}

export function summarizeWangqianWeeklyByDistrict(): DistrictWeeklySummary[] {
  const all = getWangqianDistrictWeekly();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalWangqianDistrictWeekly[]>();
  for (const w of all) {
    const key = `${w.city}|${w.district}|${w.category}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(w);
  }
  const out: DistrictWeeklySummary[] = [];
  for (const [, arr] of grouped.entries()) {
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    const totalUnits = arr.reduce((s, x) => s + x.totalUnits, 0);
    const days = arr.reduce((s, x) => s + x.days, 0);
    const avgDailyUnits =
      days > 0
        ? arr.reduce((s, x) => s + x.avgDailyUnits * x.days, 0) / days
        : 0;
    const latest = arr[arr.length - 1]!;
    out.push({
      city: latest.city,
      district: latest.district,
      category: latest.category,
      weekCount: arr.length,
      totalUnits,
      avgDailyUnits,
      latestUnits: latest.totalUnits,
      latestWeekEnd: latest.weekEnd
    });
  }
  return out;
}

export interface DistrictWoWChange {
  city: string;
  district: string;
  category: LocalWangqianDistrictWeekly["category"];
  prevUnits: number;
  latestUnits: number;
  /** 百分比变化 (+x.x%) */
  changePct: number;
}

function pctChange(prev: number, latest: number): number {
  if (prev === 0) return latest > 0 ? Number.POSITIVE_INFINITY : 0;
  return ((latest - prev) / prev) * 100;
}

/** 计算每个 (city, district, category) 的"最近一周 vs 前一周"WoW 变化 */
export function getWangqianWeeklyWoWChange(): DistrictWoWChange[] {
  const all = getWangqianDistrictWeekly();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalWangqianDistrictWeekly[]>();
  for (const w of all) {
    const key = `${w.city}|${w.district}|${w.category}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(w);
  }
  const out: DistrictWoWChange[] = [];
  for (const [, arr] of grouped.entries()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    const prev = arr[arr.length - 2]!;
    const latest = arr[arr.length - 1]!;
    out.push({
      city: latest.city,
      district: latest.district,
      category: latest.category,
      prevUnits: prev.totalUnits,
      latestUnits: latest.totalUnits,
      changePct: pctChange(prev.totalUnits, latest.totalUnits)
    });
  }
  return out;
}

/** 变异系数 CV（std / mean）—— 越高越不稳定 */
export interface DistrictVolatility {
  city: string;
  district: string;
  category: LocalWangqianDistrictWeekly["category"];
  weekCount: number;
  mean: number;
  stdDev: number;
  cv: number;
}

export function getWangqianWeeklyVolatility(): DistrictVolatility[] {
  const all = getWangqianDistrictWeekly();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalWangqianDistrictWeekly[]>();
  for (const w of all) {
    const key = `${w.city}|${w.district}|${w.category}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(w);
  }
  const out: DistrictVolatility[] = [];
  for (const [, arr] of grouped.entries()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    const units = arr.map((x) => x.totalUnits);
    const mean = units.reduce((s, x) => s + x, 0) / units.length;
    const variance =
      units.reduce((s, x) => s + (x - mean) ** 2, 0) / units.length;
    const stdDev = Math.sqrt(variance);
    out.push({
      city: arr[0]!.city,
      district: arr[0]!.district,
      category: arr[0]!.category,
      weekCount: arr.length,
      mean,
      stdDev,
      cv: mean > 0 ? stdDev / mean : 0
    });
  }
  return out;
}

/**
 * 检测最近一周较前 N 周（默认 4 周）平均"突增 X 倍"的区。
 * 用于捕捉"开盘 / 政策刺激 / 学区房集中过户"等异常活跃。
 */
export interface DistrictSpike {
  city: string;
  district: string;
  category: LocalWangqianDistrictWeekly["category"];
  recentAvg: number;
  latestUnits: number;
  /** 倍数（latest / recentAvg） */
  multiplier: number;
  weekEnd: string;
}

export function getWangqianWeeklyRecentSpikes(
  lookbackWeeks: number = 4,
  minMultiplier: number = 1.5
): DistrictSpike[] {
  const all = getWangqianDistrictWeekly();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalWangqianDistrictWeekly[]>();
  for (const w of all) {
    const key = `${w.city}|${w.district}|${w.category}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(w);
  }
  const out: DistrictSpike[] = [];
  for (const [, arr] of grouped.entries()) {
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    if (arr.length < lookbackWeeks + 1) continue;
    const recent = arr.slice(arr.length - lookbackWeeks - 1, arr.length - 1);
    const recentAvg =
      recent.reduce((s, x) => s + x.totalUnits, 0) / recent.length;
    const latest = arr[arr.length - 1]!;
    if (recentAvg <= 0) continue;
    const multiplier = latest.totalUnits / recentAvg;
    if (multiplier >= minMultiplier) {
      out.push({
        city: latest.city,
        district: latest.district,
        category: latest.category,
        recentAvg,
        latestUnits: latest.totalUnits,
        multiplier,
        weekEnd: latest.weekEnd
      });
    }
  }
  out.sort((a, b) => b.multiplier - a.multiplier);
  return out;
}

/** 按 (city, category) 整市 trend：最近一周 vs 前 N 周 */
export interface CityCategoryTrend {
  city: string;
  category: LocalWangqianDistrictWeekly["category"];
  recentAvg: number;
  latestUnits: number;
  changePct: number;
  weekEnd: string;
}

export function getWangqianWeeklyByCityCategoryTrend(
  lookbackWeeks: number = 4
): CityCategoryTrend[] {
  const all = getWangqianDistrictWeekly();
  if (all.length === 0) return [];
  // 按 (city, category, weekEnd) 求和
  const rolled = new Map<
    string,
    { city: string; category: LocalWangqianDistrictWeekly["category"]; weekEnd: string; units: number }
  >();
  for (const w of all) {
    const key = `${w.city}|${w.category}|${w.weekEnd}`;
    let cur = rolled.get(key);
    if (!cur) {
      cur = {
        city: w.city,
        category: w.category,
        weekEnd: w.weekEnd,
        units: 0
      };
      rolled.set(key, cur);
    }
    cur.units += w.totalUnits;
  }
  // 按 (city, category) 分组
  const grouped = new Map<
    string,
    Array<{ city: string; category: LocalWangqianDistrictWeekly["category"]; weekEnd: string; units: number }>
  >();
  for (const v of rolled.values()) {
    const key = `${v.city}|${v.category}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(v);
  }
  const out: CityCategoryTrend[] = [];
  for (const [, arr] of grouped.entries()) {
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    if (arr.length < lookbackWeeks + 1) continue;
    const recent = arr.slice(arr.length - lookbackWeeks - 1, arr.length - 1);
    const recentAvg = recent.reduce((s, x) => s + x.units, 0) / recent.length;
    const latest = arr[arr.length - 1]!;
    out.push({
      city: latest.city,
      category: latest.category,
      recentAvg,
      latestUnits: latest.units,
      changePct: pctChange(recentAvg, latest.units),
      weekEnd: latest.weekEnd
    });
  }
  out.sort((a, b) => b.changePct - a.changePct);
  return out;
}