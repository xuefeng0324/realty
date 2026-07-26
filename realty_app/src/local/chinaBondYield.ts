import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/chinabond_yield.csv?raw";

/** 中债国债收益率（%）；≠房价/挂牌/网签/70城 */
export interface ChinaBondYieldRow {
  date: string;
  y3m: number;
  y6m: number;
  y1y: number;
  y3y: number;
  y5y: number;
  y7y: number;
  y10y: number;
  y30y: number;
  spread10y1y: number;
  source: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): ChinaBondYieldRow | null {
  const date = String(row.date ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!sourceUrl.includes("chinabond.com.cn")) return null;
  const y10y = n(row.y10y);
  if (!(y10y > 0)) return null;
  return {
    date,
    y3m: n(row.y3m),
    y6m: n(row.y6m),
    y1y: n(row.y1y),
    y3y: n(row.y3y),
    y5y: n(row.y5y),
    y7y: n(row.y7y),
    y10y,
    y30y: n(row.y30y),
    spread10y1y: n(row.spread_10y_1y),
    source: String(row.source ?? "").trim(),
    sourceUrl
  };
}

export function loadChinaBondYieldFromCSV(text: string): ChinaBondYieldRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is ChinaBondYieldRow => !!r)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: ChinaBondYieldRow[] = loadChinaBondYieldFromCSV(String(rawCsv ?? ""));

export function getChinaBondYield(): ChinaBondYieldRow[] {
  return [...rows];
}

/** 仪表盘用：与 getChinaBondYield 同序（新→旧） */
export function getChinaBondYieldHistory(): ChinaBondYieldRow[] {
  return getChinaBondYield();
}

export function getLatestChinaBondYield(): ChinaBondYieldRow | null {
  return rows[0] ?? null;
}

export function getChinaBondYieldDeltaVsPrev(): {
  prev: ChinaBondYieldRow;
  y10yDeltaPp: number;
  y1yDeltaPp: number;
  spreadDeltaPp: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    y10yDeltaPp: Math.round((cur.y10y - prev.y10y) * 10000) / 10000,
    y1yDeltaPp: Math.round((cur.y1y - prev.y1y) * 10000) / 10000,
    spreadDeltaPp: Math.round((cur.spread10y1y - prev.spread10y1y) * 10000) / 10000
  };
}

export function getChinaBondYieldTrend(limit = 8): ChinaBondYieldRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setChinaBondYieldForTest(next: ChinaBondYieldRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
