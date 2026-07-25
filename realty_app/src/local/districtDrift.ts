/**
 * v0.93.0 派生：分区近 12 周均价变动排行。
 *
 * 输入：snapshot.districtTrends（LocalDistrictTrend[]，共 269 行 = 15 区 × ~27 周），
 * 每行表示某城市某区某周末的均价 / 中位价 / 挂牌数等聚合。
 *
 * 派生指标：
 *   - getDistrict12WeekChangeRank: 按 "末周均价 vs 12 周前均价" 计算变化率，
 *     按变化率降序输出"涨 / 跌 / 不变"三档。
 *   - getDistrictRecentMomentumRank: 最近 4 周均价均值 / 前 4 周均价均值 - 1，
 *     用于回答"区是否还在加速涨"或"开始减速"。
 *   - getDistrictPriceSummary: 某区的末周均价 + 窗口最高 / 最低 + 周数。
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getDistrictTrendByDistrict, getDistrictTrends } from "./store";
import type { LocalDistrictTrend } from "./types";

export interface DistrictChangeEntry {
  cityId: number;
  districtName: string;
  /** 回溯基准（最近 12 周内最早一周）的均价 */
  basePrice: number;
  /** 最近一周均价 */
  latestPrice: number;
  /** (latest - base) / base，正值 = 涨 / 负值 = 跌 */
  change: number;
  /** 数据覆盖的周数 */
  weeksAvailable: number;
  /** 最近一周挂牌数 */
  latestListingCount: number;
}

const TIER_RECENT_WEEKS = 12;
const TIER_MOMENTUM_RECENT = 4;
const TIER_MOMENTUM_PRIOR = 4;

export interface DistrictChangeRankOptions {
  /** 至少需要多少周才参与排名（默认 2，向后兼容） */
  minWeeks?: number;
  /** 是否严格按"12 周前"作为基线（无 12 周则跳过）。
   *  设 true 时即便 arr.length=12 也用 arr[0] 作为 base（已经 12 周前的近似）。
   *  默认 true —— 与 dashboard "近 12 周" 主题更贴合。 */
  strictBase?: boolean;
}

export function getDistrict12WeekChangeRank(
  cityId?: number,
  options: DistrictChangeRankOptions = {}
): DistrictChangeEntry[] {
  const minWeeks = options.minWeeks ?? 2;
  const strictBase = options.strictBase ?? true;
  const grouped = groupTrendsByDistrict(cityId);
  const out: DistrictChangeEntry[] = [];
  for (const arr of grouped.values()) {
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    // strictBase 模式下，要求至少 13 周才有真正的"12 周前"基线；
    // 否则跳过，让上层用更严格的 minWeeks 阈值筛选。
    if (strictBase && arr.length < TIER_RECENT_WEEKS + 1) continue;
    if (arr.length < minWeeks) continue;
    const latest = arr[arr.length - 1];
    const baseIdx = Math.max(0, arr.length - TIER_RECENT_WEEKS - 1);
    const base = arr[baseIdx];
    if (base.avgUnitPrice <= 0) continue;
    const change =
      (latest.avgUnitPrice - base.avgUnitPrice) / base.avgUnitPrice;
    out.push({
      cityId: latest.cityId,
      districtName: latest.districtName,
      basePrice: base.avgUnitPrice,
      latestPrice: latest.avgUnitPrice,
      change,
      weeksAvailable: arr.length,
      latestListingCount: latest.listingCount
    });
  }
  out.sort((a, b) => b.change - a.change);
  return out;
}

/** 派生：汇总"涨 / 跌"分布，便于 dashboard 上同时显示宽松 vs 严格两个口径。 */
export function summarizeChangeDistribution(
  cityId?: number
): { up: number; down: number; total: number; strictUp: number; strictDown: number; strictTotal: number } {
  const loose = getDistrict12WeekChangeRank(cityId, {
    minWeeks: 2,
    strictBase: false
  });
  const strict = getDistrict12WeekChangeRank(cityId, {
    minWeeks: 13,
    strictBase: true
  });
  return {
    up: loose.filter((r) => r.change > 0).length,
    down: loose.filter((r) => r.change < 0).length,
    total: loose.length,
    strictUp: strict.filter((r) => r.change > 0).length,
    strictDown: strict.filter((r) => r.change < 0).length,
    strictTotal: strict.length
  };
}

export interface DistrictMomentumEntry {
  cityId: number;
  districtName: string;
  recentAvg: number | null;
  priorAvg: number | null;
  /** (recent - prior) / prior */
  momentum: number | null;
  /** 最近 N 周的均价序列 */
  recentSeries: { weekEnd: string; price: number }[];
  /** 数据覆盖周数 */
  weeksAvailable: number;
}

export function getDistrictRecentMomentumRank(
  cityId?: number
): DistrictMomentumEntry[] {
  const grouped = groupTrendsByDistrict(cityId);
  const out: DistrictMomentumEntry[] = [];
  for (const arr of grouped.values()) {
    arr.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
    const head = arr[arr.length - 1];
    if (arr.length < TIER_MOMENTUM_RECENT + TIER_MOMENTUM_PRIOR) {
      out.push({
        cityId: head?.cityId ?? 0,
        districtName: head?.districtName ?? "",
        recentAvg: null,
        priorAvg: null,
        momentum: null,
        recentSeries: arr.slice(-TIER_MOMENTUM_RECENT).map((r) => ({
          weekEnd: r.weekEnd,
          price: r.avgUnitPrice
        })),
        weeksAvailable: arr.length
      });
      continue;
    }
    const recent = arr.slice(-TIER_MOMENTUM_RECENT);
    const prior = arr.slice(
      -TIER_MOMENTUM_RECENT - TIER_MOMENTUM_PRIOR,
      -TIER_MOMENTUM_RECENT
    );
    const recentAvg = avg(recent.map((r) => r.avgUnitPrice));
    const priorAvg = avg(prior.map((r) => r.avgUnitPrice));
    const momentum =
      recentAvg != null && priorAvg != null && priorAvg !== 0
        ? (recentAvg - priorAvg) / priorAvg
        : null;
    out.push({
      cityId: head.cityId,
      districtName: head.districtName,
      recentAvg,
      priorAvg,
      momentum,
      recentSeries: recent.map((r) => ({
        weekEnd: r.weekEnd,
        price: r.avgUnitPrice
      })),
      weeksAvailable: arr.length
    });
  }
  out.sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0));
  return out;
}

export interface DistrictPriceSummary {
  cityId: number;
  districtName: string;
  latest: LocalDistrictTrend | null;
  /** 窗口内最低 / 最高均价 */
  minPrice: number | null;
  maxPrice: number | null;
  weeks: number;
}

/** 单分区"最近窗口价"摘要，用于 dashboard 卡片。 */
export function getDistrictPriceSummary(
  cityId: number,
  districtName: string,
  recentWeeks: number = 12
): DistrictPriceSummary {
  const arr = getDistrictTrendByDistrict(cityId, districtName);
  if (arr.length === 0) {
    return {
      cityId,
      districtName,
      latest: null,
      minPrice: null,
      maxPrice: null,
      weeks: 0
    };
  }
  const tail = arr.slice(-recentWeeks);
  const prices = tail.map((t) => t.avgUnitPrice);
  return {
    cityId,
    districtName,
    latest: arr[arr.length - 1] ?? null,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    weeks: tail.length
  };
}

/** (cityId, districtName) → 行升序列表。可选按城市过滤。 */
function groupTrendsByDistrict(cityId?: number): Map<string, LocalDistrictTrend[]> {
  const grouped = new Map<string, LocalDistrictTrend[]>();
  for (const t of getDistrictTrends()) {
    if (cityId != null && t.cityId !== cityId) continue;
    const k = `${t.cityId}|${t.districtName}`;
    const arr = grouped.get(k);
    if (arr) {
      arr.push(t);
    } else {
      grouped.set(k, [t]);
    }
  }
  return grouped;
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
