import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_usd_mid.csv?raw";

/** 外管局人民币对美元中间价（日度）；≠房价/挂牌/网签/70城 */
export interface SafeUsdMidRow {
  date: string;
  usdCny: number;
  usdPer100: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeUsdMidRow {
  const usdPer100 = n(row.usd_per100);
  const usdCnyRaw = n(row.usd_cny);
  const usdCny = usdCnyRaw || (usdPer100 ? usdPer100 / 100 : 0);
  return {
    date: String(row.date ?? "").trim(),
    usdCny,
    usdPer100: usdPer100 || usdCny * 100,
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeUsdMidFromCSV(text: string): SafeUsdMidRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.usdCny > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeUsdMidRow[] = loadSafeUsdMidFromCSV(String(rawCsv ?? ""));

export function getSafeUsdMid(): SafeUsdMidRow[] {
  return [...rows];
}

export function getLatestSafeUsdMid(): SafeUsdMidRow | null {
  return rows[0] ?? null;
}

export function getSafeUsdMidDeltaVsPrev(): {
  prev: SafeUsdMidRow;
  delta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return { prev, delta: Math.round((cur.usdCny - prev.usdCny) * 10000) / 10000 };
}

/** 最近一个月交易日简单算术平均（按最新日期所在自然月） */
export function getSafeUsdMidMonthAverage(latest?: SafeUsdMidRow | null): {
  month: string;
  avg: number;
  count: number;
} | null {
  const cur = latest ?? rows[0];
  if (!cur) return null;
  const month = cur.date.slice(0, 7);
  const inMonth = rows.filter((r) => r.date.startsWith(month));
  if (!inMonth.length) return null;
  const avg =
    Math.round((inMonth.reduce((s, r) => s + r.usdCny, 0) / inMonth.length) * 10000) / 10000;
  return { month, avg, count: inMonth.length };
}

export function __setSafeUsdMidForTest(next: SafeUsdMidRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
