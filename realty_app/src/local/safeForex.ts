import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_forex.csv?raw";

/** 外管局月末外汇储备（亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeForexRow {
  date: string;
  forexUsdYi: number;
  momDeltaUsdYi: number;
  momPct: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeForexRow {
  return {
    date: String(row.date ?? "").trim(),
    forexUsdYi: n(row.forex_usd_yi),
    momDeltaUsdYi: n(row.mom_delta_usd_yi),
    momPct: n(row.mom_pct),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeForexFromCSV(text: string): SafeForexRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.forexUsdYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeForexRow[] = loadSafeForexFromCSV(String(rawCsv ?? ""));

export function getSafeForex(): SafeForexRow[] {
  return [...rows];
}

export function getLatestSafeForex(): SafeForexRow | null {
  return rows[0] ?? null;
}

export function getSafeForexDeltaVsPrev(): {
  prev: SafeForexRow;
  deltaUsdYi: number;
  deltaPct: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  const deltaUsdYi =
    cur.momDeltaUsdYi ||
    Math.round((cur.forexUsdYi - prev.forexUsdYi) * 100) / 100;
  const deltaPct =
    cur.momPct ||
    (prev.forexUsdYi
      ? Math.round(((cur.forexUsdYi - prev.forexUsdYi) / prev.forexUsdYi) * 10000) / 100
      : 0);
  return { prev, deltaUsdYi, deltaPct };
}

export function __setSafeForexForTest(next: SafeForexRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
