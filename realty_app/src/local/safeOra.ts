import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_ora.csv?raw";

/** 外管局官方储备资产月度分项（亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeOraRow {
  date: string;
  forexUsdYi: number;
  imfUsdYi: number;
  sdrUsdYi: number;
  goldUsdYi: number;
  goldOzWan: number;
  otherUsdYi: number;
  totalUsdYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeOraRow {
  return {
    date: String(row.date ?? "").trim(),
    forexUsdYi: n(row.forex_usd_yi),
    imfUsdYi: n(row.imf_usd_yi),
    sdrUsdYi: n(row.sdr_usd_yi),
    goldUsdYi: n(row.gold_usd_yi),
    goldOzWan: n(row.gold_oz_wan),
    otherUsdYi: n(row.other_usd_yi),
    totalUsdYi: n(row.total_usd_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeOraFromCSV(text: string): SafeOraRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.totalUsdYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeOraRow[] = loadSafeOraFromCSV(String(rawCsv ?? ""));

export function getSafeOra(): SafeOraRow[] {
  return [...rows];
}

export function getLatestSafeOra(): SafeOraRow | null {
  return rows[0] ?? null;
}

export function getSafeOraDeltaVsPrev(): {
  prev: SafeOraRow;
  totalDelta: number;
  goldDelta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    totalDelta: Math.round((cur.totalUsdYi - prev.totalUsdYi) * 100) / 100,
    goldDelta: Math.round((cur.goldUsdYi - prev.goldUsdYi) * 100) / 100
  };
}

/** 黄金占官方储备合计比例（%） */
export function getSafeOraGoldShare(row?: SafeOraRow | null): number | null {
  const r = row ?? rows[0];
  if (!r || !(r.totalUsdYi > 0) || !(r.goldUsdYi > 0)) return null;
  return Math.round((r.goldUsdYi / r.totalUsdYi) * 10000) / 100;
}

export function __setSafeOraForTest(next: SafeOraRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
