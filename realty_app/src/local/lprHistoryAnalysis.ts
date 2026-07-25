/**
 * v1.111.0 派生：LPR 历史时间序列（v0.53 既有数据源）。
 *
 * 输入：snapshot.lprHistory（LocalLprRow[]，83 行 × 4 利率 × 2019-08 ~ 2026-06）。
 * 每行：month (YYYY-MM) + lpr1y + lpr5y + mortgageFirst + mortgageSecond (%)。
 *
 * 派生：
 *   - getLprLatest: 最新一行（"当前 LPR"快照）
 *   - getLprByYear: 某年所有月份（年视图）
 *   - summarizeLprByYear: 年聚合（年末 LPR + 年内最大/最小 + 调息次数）
 *   - detectLprCutCycles: 自动检测调息周期（lpr5y 变化的所有节点 + 方向 + 累计幅度）
 *   - getLprAtMonth(month): 某月精确查询
 *   - getLprDelta(fromMonth, toMonth): 区间累计变动 bp
 *   - getLprRange(minMonth, maxMonth): 区间全部行（按月升序）
 *   - summarizeLprCurrentVsYearAgo: 当前 vs 1 年前 4 利率对比（bp）
 *   - getLprLongestFlatStreak: 最长连续"未调息"月数（lpr5y）
 *   - summarizeLprSpread: 首套 vs 二套 利差时间线 + 当前利差
 *   - getLprDownwardCumulative: 自 2019 起点累计降息幅度（bp）
 *   - getLprMonthlyAverage: 全期 lpr5y / lpr1y 平均值
 */

import { getLprHistory } from "./store";
import type { LocalLprRow } from "./types";

export interface YearLprSummary {
  year: number;
  /** 该年第一行的 lpr5y（年初） */
  startLpr5y: number;
  /** 该年最后一行（年末月 ≤ 当下月）的 lpr5y */
  endLpr5y: number;
  /** 年内 lpr5y 最低 */
  minLpr5y: number;
  /** 年内 lpr5y 最高 */
  maxLpr5y: number;
  /** 年内调息次数（lpr5y 变化的月数） */
  changeCount: number;
  /** 年末 lpr1y */
  endLpr1y: number;
  /** 年末首套/二套 */
  endMortgageFirst: number;
  endMortgageSecond: number;
}

export function summarizeLprByYear(): YearLprSummary[] {
  const all = getLprHistory();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalLprRow[]>();
  for (const x of all) {
    const y = parseInt(x.month.slice(0, 4), 10);
    let arr = grouped.get(y);
    if (!arr) {
      arr = [];
      grouped.set(y, arr);
    }
    arr.push(x);
  }
  const out: YearLprSummary[] = [];
  for (const [year, arr] of grouped.entries()) {
    arr.sort((a, b) => a.month.localeCompare(b.month));
    const start = arr[0]!;
    const end = arr[arr.length - 1]!;
    let changeCount = 0;
    let minLpr5y = start.lpr5y;
    let maxLpr5y = start.lpr5y;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i]!.lpr5y !== arr[i - 1]!.lpr5y) changeCount++;
      if (arr[i]!.lpr5y < minLpr5y) minLpr5y = arr[i]!.lpr5y;
      if (arr[i]!.lpr5y > maxLpr5y) maxLpr5y = arr[i]!.lpr5y;
    }
    out.push({
      year,
      startLpr5y: start.lpr5y,
      endLpr5y: end.lpr5y,
      minLpr5y,
      maxLpr5y,
      changeCount,
      endLpr1y: end.lpr1y,
      endMortgageFirst: end.mortgageFirst,
      endMortgageSecond: end.mortgageSecond
    });
  }
  out.sort((a, b) => a.year - b.year);
  return out;
}

export interface LprCycle {
  /** 变动月份 */
  month: string;
  /** 变动前 lpr5y */
  fromLpr5y: number;
  /** 变动后 lpr5y */
  toLpr5y: number;
  /** 变动方向: "down" | "up" | "flat" */
  direction: "down" | "up" | "flat";
  /** 累计变动幅度（bp），从数据起点累计 */
  cumulativeBp: number;
  /** 单次变动幅度（bp），正=降息 */
  changeBp: number;
}

/** lpr5y 变化的所有节点 + 方向 + 累计幅度 */
export function detectLprCutCycles(): LprCycle[] {
  const all = getLprHistory();
  if (all.length === 0) return [];
  const sorted = [...all].sort((a, b) => a.month.localeCompare(b.month));
  const out: LprCycle[] = [];
  let prev = sorted[0]!.lpr5y;
  const baseline = prev;
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (cur.lpr5y !== prev) {
      const changeBp = Math.round((prev - cur.lpr5y) * 100); // 1% = 100bp; 降息=正
      const cumulativeBp = Math.round((baseline - cur.lpr5y) * 100);
      out.push({
        month: cur.month,
        fromLpr5y: prev,
        toLpr5y: cur.lpr5y,
        direction: cur.lpr5y < prev ? "down" : "up",
        cumulativeBp,
        changeBp
      });
      prev = cur.lpr5y;
    }
  }
  return out;
}

export function getLprLatest(): LocalLprRow | null {
  const all = getLprHistory();
  if (all.length === 0) return null;
  return [...all].sort((a, b) => b.month.localeCompare(a.month))[0]!;
}

export function getLprByYear(year: number): LocalLprRow[] {
  return getLprHistory()
    .filter((x) => x.month.startsWith(`${year}-`))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function getLprAtMonth(month: string): LocalLprRow | null {
  return getLprHistory().find((x) => x.month === month) ?? null;
}

/** 区间累计变动 bp（正=降息）；返回 null 若端点缺失 */
export function getLprDelta(
  fromMonth: string,
  toMonth: string
): {
  lpr1yDeltaBp: number;
  lpr5yDeltaBp: number;
  mortgageFirstDeltaBp: number;
  mortgageSecondDeltaBp: number;
} | null {
  const a = getLprAtMonth(fromMonth);
  const b = getLprAtMonth(toMonth);
  if (!a || !b) return null;
  return {
    lpr1yDeltaBp: Math.round((a.lpr1y - b.lpr1y) * 100),
    lpr5yDeltaBp: Math.round((a.lpr5y - b.lpr5y) * 100),
    mortgageFirstDeltaBp: Math.round((a.mortgageFirst - b.mortgageFirst) * 100),
    mortgageSecondDeltaBp: Math.round(
      (a.mortgageSecond - b.mortgageSecond) * 100
    )
  };
}

/** 区间全部行（按月升序，包含端点） */
export function getLprRange(
  minMonth: string,
  maxMonth: string
): LocalLprRow[] {
  return getLprHistory()
    .filter((x) => x.month >= minMonth && x.month <= maxMonth)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** 当前 vs 1 年前 4 利率对比（bp） */
export function summarizeLprCurrentVsYearAgo(): {
  current: LocalLprRow | null;
  yearAgo: LocalLprRow | null;
  lpr1yDeltaBp: number | null;
  lpr5yDeltaBp: number | null;
  mortgageFirstDeltaBp: number | null;
  mortgageSecondDeltaBp: number | null;
} {
  const cur = getLprLatest();
  if (!cur) {
    return {
      current: null,
      yearAgo: null,
      lpr1yDeltaBp: null,
      lpr5yDeltaBp: null,
      mortgageFirstDeltaBp: null,
      mortgageSecondDeltaBp: null
    };
  }
  // 当前月往前推 12 个月
  const [y, m] = cur.month.split("-").map(Number) as [number, number];
  const targetYear = y - 1;
  const targetMonth = `${targetYear}-${String(m).padStart(2, "0")}`;
  const ya = getLprAtMonth(targetMonth);
  if (!ya) {
    return {
      current: cur,
      yearAgo: null,
      lpr1yDeltaBp: null,
      lpr5yDeltaBp: null,
      mortgageFirstDeltaBp: null,
      mortgageSecondDeltaBp: null
    };
  }
  return {
    current: cur,
    yearAgo: ya,
    lpr1yDeltaBp: Math.round((ya.lpr1y - cur.lpr1y) * 100),
    lpr5yDeltaBp: Math.round((ya.lpr5y - cur.lpr5y) * 100),
    mortgageFirstDeltaBp: Math.round((ya.mortgageFirst - cur.mortgageFirst) * 100),
    mortgageSecondDeltaBp: Math.round(
      (ya.mortgageSecond - cur.mortgageSecond) * 100
    )
  };
}

/** 最长连续"未调息"月数（lpr5y 不变） */
export function getLprLongestFlatStreak(): {
  startMonth: string;
  endMonth: string;
  months: number;
} {
  const all = getLprHistory();
  if (all.length === 0) return { startMonth: "", endMonth: "", months: 0 };
  const sorted = [...all].sort((a, b) => a.month.localeCompare(b.month));
  let bestStart = sorted[0]!.month;
  let bestEnd = sorted[0]!.month;
  let bestMonths = 0;
  let curStart = sorted[0]!.month;
  let curEnd = sorted[0]!.month;
  let curMonths = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.lpr5y === sorted[i - 1]!.lpr5y) {
      curEnd = sorted[i]!.month;
      curMonths++;
    } else {
      if (curMonths > bestMonths) {
        bestMonths = curMonths;
        bestStart = curStart;
        bestEnd = curEnd;
      }
      curStart = sorted[i]!.month;
      curEnd = sorted[i]!.month;
      curMonths = 1;
    }
  }
  if (curMonths > bestMonths) {
    bestMonths = curMonths;
    bestStart = curStart;
    bestEnd = curEnd;
  }
  return { startMonth: bestStart, endMonth: bestEnd, months: bestMonths };
}

export interface LprSpreadSnapshot {
  month: string;
  /** 首套 - lpr5y */
  firstSpreadBp: number;
  /** 二套 - lpr5y */
  secondSpreadBp: number;
  /** 二套 - 首套 */
  firstSecondDeltaBp: number;
}

/** 首套/二套 vs lpr5y 利差时间线 + 首套 vs 二套 差额 */
export function summarizeLprSpread(): {
  current: LprSpreadSnapshot | null;
  history: LprSpreadSnapshot[];
} {
  const all = getLprHistory();
  if (all.length === 0) return { current: null, history: [] };
  const sorted = [...all].sort((a, b) => a.month.localeCompare(b.month));
  const history: LprSpreadSnapshot[] = sorted.map((x) => ({
    month: x.month,
    firstSpreadBp: Math.round((x.mortgageFirst - x.lpr5y) * 100),
    secondSpreadBp: Math.round((x.mortgageSecond - x.lpr5y) * 100),
    firstSecondDeltaBp: Math.round(
      (x.mortgageSecond - x.mortgageFirst) * 100
    )
  }));
  return { current: history[history.length - 1]!, history };
}

/** 自数据起点累计降息幅度（bp） */
export interface CumulativeCut {
  startMonth: string;
  endMonth: string;
  lpr5yCumulativeBp: number;
  lpr1yCumulativeBp: number;
  mortgageFirstCumulativeBp: number;
  mortgageSecondCumulativeBp: number;
}

export function getLprDownwardCumulative(): CumulativeCut | null {
  const all = getLprHistory();
  if (all.length < 2) return null;
  const sorted = [...all].sort((a, b) => a.month.localeCompare(b.month));
  const start = sorted[0]!;
  const end = sorted[sorted.length - 1]!;
  return {
    startMonth: start.month,
    endMonth: end.month,
    lpr5yCumulativeBp: Math.round((start.lpr5y - end.lpr5y) * 100),
    lpr1yCumulativeBp: Math.round((start.lpr1y - end.lpr1y) * 100),
    mortgageFirstCumulativeBp: Math.round(
      (start.mortgageFirst - end.mortgageFirst) * 100
    ),
    mortgageSecondCumulativeBp: Math.round(
      (start.mortgageSecond - end.mortgageSecond) * 100
    )
  };
}

/** 全期 lpr5y / lpr1y 平均值 */
export function getLprMonthlyAverage(): {
  lpr5yAvg: number;
  lpr1yAvg: number;
  mortgageFirstAvg: number;
  mortgageSecondAvg: number;
  monthCount: number;
} | null {
  const all = getLprHistory();
  if (all.length === 0) return null;
  return {
    lpr5yAvg: all.reduce((s, x) => s + x.lpr5y, 0) / all.length,
    lpr1yAvg: all.reduce((s, x) => s + x.lpr1y, 0) / all.length,
    mortgageFirstAvg: all.reduce((s, x) => s + x.mortgageFirst, 0) / all.length,
    mortgageSecondAvg: all.reduce((s, x) => s + x.mortgageSecond, 0) / all.length,
    monthCount: all.length
  };
}