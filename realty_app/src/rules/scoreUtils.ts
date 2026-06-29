/**
 * 通用工具，对应 Python 端 `realty/backend/app/services/score_utils.py`。
 * 保持字段名与 Python 版完全一致，方便对照单测。
 */

export function clamp(x: number | null | undefined, lo: number, hi: number): number {
  if (x == null || Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

const FLOOR_RE = /(-?\d+)/;

export function parseFloorNumber(floorNumber: string | null | undefined): number | null {
  if (!floorNumber) return null;
  const m = FLOOR_RE.exec(floorNumber);
  if (!m) return null;
  try {
    return parseInt(m[1], 10);
  } catch {
    return null;
  }
}

/**
 * Python 版的 maybe_scale_trend_delta：
 * - abs <= 1.0 当作百分比，乘 100
 * - 否则当作已 scale 的值，原样返回
 */
export function maybeScaleTrendDelta(trendDeltaRaw: number): number {
  if (Math.abs(trendDeltaRaw) <= 1.0) return trendDeltaRaw * 100.0;
  return trendDeltaRaw;
}

export function currentYearFloor(d: Date | null = null): number {
  return (d ?? new Date()).getFullYear();
}

export interface MissingFallback {
  field: string;
  policy: string;
  reason: string;
}

export function jsonListMax(values: number[] | null | undefined): number | null {
  if (!values || values.length === 0) return null;
  return Math.max(...values);
}