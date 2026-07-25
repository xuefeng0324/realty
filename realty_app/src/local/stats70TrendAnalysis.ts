/**
 * v1.116.0 派生：全国 70 城价格指数时序派生。
 *
 * 输入：LocalStats70Row[]（crawl_stats_70.py 月度爬取），每条含 date / city / fixed_base(同比|环比)
 *      / new_idx / second_idx。
 *
 * 注意：stats70 不是单一时间点，而是月度时序快照（多个月份）。
 * "近 12 月同比" 派生：取 city × fixed_base 组合下最新月的同比/环比指数。
 *
 * 派生：
 *   - getStats70LatestMonth: 返回最新月份字符串（如 "2025/12/1"）
 *   - getStats70MonthOptions: 返回所有可选月份（升序）
 *   - getStats70LatestByCity: 某 city 最新月 4 指数（newYoY/newMoM/secondYoY/secondMoM）
 *   - getStats70TopByTypeByMonth: 某月某 fixed_base × new/second 跨城 Top N（涨/跌）
 *   - getStats70CurrentCityNationalRank: 当前 city 在全国排位（多少城里 top X%）
 *   - getStats70CityOver12MonthChange: 单 city 近 12 月（同比）的 4 个指数变化轨迹
 *   - getStats70CrossCityByMonthSpread: 某月 4 指数的"最值差"（全国最分散程度）
 *   - getStats70CityTrendDirection: 单 city 近 3 月趋势方向（涨/跌/平稳）
 *   - getStats70CrossCityByCityCount: 4 指数下"上涨城市数" / "下跌城市数"
 */

import { getStats70 } from "./store";
import type { LocalStats70Row } from "./types";

export type FixedBase = "同比" | "环比";
export type IndexType = "new_idx" | "second_idx";

export interface CityLatestIndex {
  city: string;
  date: string;
  newYoY: number | null;
  newMoM: number | null;
  secondYoY: number | null;
  secondMoM: number | null;
}

/** 全部可选月份升序（按 YYYY/M/D 数值化排序，避免字典序把 11/12 排在 2/3 之前） */
export function getStats70MonthOptions(): string[] {
  const all = getStats70();
  if (all.length === 0) return [];
  const set = new Set<string>();
  for (const r of all) set.add(r.date);
  return Array.from(set).sort((a, b) => compareMonthStr(a, b));
}

/** 把 "2025/12/1" 数值化（YYYY*10000 + M*100 + D） */
function monthStrKey(s: string): number {
  const parts = s.split("/");
  if (parts.length < 3) return 0;
  const y = parseInt(parts[0]!, 10) || 0;
  const m = parseInt(parts[1]!, 10) || 0;
  const d = parseInt(parts[2]!, 10) || 0;
  return y * 10000 + m * 100 + d;
}

function compareMonthStr(a: string, b: string): number {
  return monthStrKey(a) - monthStrKey(b);
}

/** 最新月份字符串 */
export function getStats70LatestMonth(): string | null {
  const arr = getStats70MonthOptions();
  return arr.length === 0 ? null : arr[arr.length - 1]!;
}

/** 某 city 最新月 4 指数 */
export function getStats70LatestByCity(city: string): CityLatestIndex | null {
  const all = getStats70();
  if (all.length === 0) return null;
  const subset = all.filter((r) => r.city === city);
  if (subset.length === 0) return null;
  // 取最大 date
  const latest = subset
    .map((r) => r.date)
    .sort((a, b) => compareMonthStr(b, a))[0]!;
  const at = subset.filter((r) => r.date === latest);
  const newRow = at.find((r) => r.fixed_base === "环比");
  const yoyRow = at.find((r) => r.fixed_base === "同比");
  return {
    city,
    date: latest,
    newYoY: yoyRow?.new_idx ?? null,
    newMoM: newRow?.new_idx ?? null,
    secondYoY: yoyRow?.second_idx ?? null,
    secondMoM: newRow?.second_idx ?? null
  };
}

export interface CityIndexEntry {
  city: string;
  date: string;
  fixedBase: FixedBase;
  indexType: IndexType;
  value: number;
}

/** 某月某 fixed_base × new/second 跨城 Top N（按 value 排序，n>0 涨 Top；n<0 跌 Top） */
export function getStats70TopByTypeByMonth(
  date: string,
  fixedBase: FixedBase,
  indexType: IndexType,
  n: number = 5
): CityIndexEntry[] {
  const subset = getStats70().filter(
    (r) =>
      r.date === date &&
      r.fixed_base === fixedBase &&
      r[indexType] != null
  );
  const enriched = subset.map((r) => ({
    city: r.city,
    date: r.date,
    fixedBase: r.fixed_base,
    indexType,
    value: r[indexType] as number
  }));
  enriched.sort((a, b) =>
    n > 0 ? b.value - a.value : a.value - b.value
  );
  return enriched.slice(0, Math.abs(n));
}

export interface CurrentCityNationalRank {
  city: string;
  /** 全国参与排名的城市数 */
  totalCities: number;
  /** 当前 city 排位（1=最涨；n=最跌） */
  rank: number;
  /** top X% */
  topPct: number;
  /** 当前 city 值 */
  value: number;
}

/** 当前 city 在全国排位（多少城里 top X%） */
export function getStats70CurrentCityNationalRank(
  city: string,
  fixedBase: FixedBase = "同比",
  indexType: IndexType = "new_idx",
  date: string | null = null
): CurrentCityNationalRank | null {
  const targetDate = date ?? getStats70LatestMonth();
  if (!targetDate) return null;
  const subset = getStats70().filter(
    (r) =>
      r.date === targetDate &&
      r.fixed_base === fixedBase &&
      r[indexType] != null
  );
  if (subset.length === 0) return null;
  const sorted = [...subset].sort(
    (a, b) => (b[indexType] as number) - (a[indexType] as number)
  );
  const idx = sorted.findIndex((r) => r.city === city);
  if (idx === -1) return null;
  const rank = idx + 1;
  return {
    city,
    totalCities: sorted.length,
    rank,
    topPct: Math.round((rank / sorted.length) * 100),
    value: sorted[idx]![indexType] as number
  };
}

/** 单 city 近 12 月（同比）的 4 个指数变化轨迹 */
export interface City12MonthPoint {
  date: string;
  newYoY: number | null;
  newMoM: number | null;
  secondYoY: number | null;
  secondMoM: number | null;
}

export function getStats70CityOver12MonthChange(
  city: string
): City12MonthPoint[] {
  const all = getStats70().filter((r) => r.city === city);
  if (all.length === 0) return [];
  const months = Array.from(new Set(all.map((r) => r.date)))
    .sort((a, b) => compareMonthStr(b, a))
    .slice(0, 12)
    .reverse();
  return months.map((date) => {
    const at = all.filter((r) => r.date === date);
    const mom = at.find((r) => r.fixed_base === "环比");
    const yoy = at.find((r) => r.fixed_base === "同比");
    return {
      date,
      newYoY: yoy?.new_idx ?? null,
      newMoM: mom?.new_idx ?? null,
      secondYoY: yoy?.second_idx ?? null,
      secondMoM: mom?.second_idx ?? null
    };
  });
}

export interface MonthSpreadEntry {
  date: string;
  fixedBase: FixedBase;
  indexType: IndexType;
  min: number;
  max: number;
  spread: number; // max - min
}

/** 某月 4 指数的"最值差"（全国最分散程度） */
export function getStats70CrossCityByMonthSpread(
  date: string
): MonthSpreadEntry[] {
  const out: MonthSpreadEntry[] = [];
  for (const fb of ["同比", "环比"] as const) {
    for (const it of ["new_idx", "second_idx"] as const) {
      const subset = getStats70().filter(
        (r) => r.date === date && r.fixed_base === fb && r[it] != null
      );
      if (subset.length === 0) continue;
      const vals = subset.map((r) => r[it] as number);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      out.push({
        date,
        fixedBase: fb,
        indexType: it,
        min,
        max,
        spread: Math.round((max - min) * 100) / 100
      });
    }
  }
  return out;
}

/** 单 city 近 3 月趋势方向（涨/跌/平稳） */
export type TrendDirection = "上涨" | "下跌" | "平稳" | "数据不足";

export interface CityTrendDirection {
  city: string;
  fixedBase: FixedBase;
  indexType: IndexType;
  direction: TrendDirection;
  /** 最近 3 月平均变化（百分点） */
  avgChangePp: number;
}

export function getStats70CityTrendDirection(
  city: string,
  fixedBase: FixedBase = "同比",
  indexType: IndexType = "new_idx"
): CityTrendDirection | null {
  const series = getStats70()
    .filter((r) => r.city === city && r.fixed_base === fixedBase)
    .sort((a, b) => compareMonthStr(a.date, b.date));
  if (series.length < 3) {
    return {
      city,
      fixedBase,
      indexType,
      direction: "数据不足",
      avgChangePp: 0
    };
  }
  // 取最近 3 个有效值
  const recent = series
    .filter((r) => r[indexType] != null)
    .slice(-3);
  if (recent.length < 3) {
    return {
      city,
      fixedBase,
      indexType,
      direction: "数据不足",
      avgChangePp: 0
    };
  }
  const v0 = recent[0]![indexType] as number;
  const v1 = recent[1]![indexType] as number;
  const v2 = recent[2]![indexType] as number;
  const d1 = v1 - v0;
  const d2 = v2 - v1;
  const avg = (d1 + d2) / 2;
  let dir: TrendDirection;
  if (avg > 0.5) dir = "上涨";
  else if (avg < -0.5) dir = "下跌";
  else dir = "平稳";
  return {
    city,
    fixedBase,
    indexType,
    direction: dir,
    avgChangePp: Math.round(avg * 100) / 100
  };
}

/** 4 指数下"上涨城市数" / "下跌城市数"（100=指数>100 → 涨；<100 → 跌） */
export interface CityCountEntry {
  date: string;
  fixedBase: FixedBase;
  indexType: IndexType;
  upCount: number;
  downCount: number;
  flatCount: number;
  total: number;
}

export function getStats70CrossCityByCityCount(
  date: string | null = null
): CityCountEntry[] {
  const targetDate = date ?? getStats70LatestMonth();
  if (!targetDate) return [];
  const out: CityCountEntry[] = [];
  for (const fb of ["同比", "环比"] as const) {
    for (const it of ["new_idx", "second_idx"] as const) {
      const subset = getStats70().filter(
        (r) => r.date === targetDate && r.fixed_base === fb && r[it] != null
      );
      if (subset.length === 0) continue;
      let up = 0;
      let down = 0;
      let flat = 0;
      for (const r of subset) {
        const v = r[it] as number;
        if (v > 100) up++;
        else if (v < 100) down++;
        else flat++;
      }
      out.push({
        date: targetDate,
        fixedBase: fb,
        indexType: it,
        upCount: up,
        downCount: down,
        flatCount: flat,
        total: subset.length
      });
    }
  }
  return out;
}