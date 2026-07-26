import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_usd_mid.csv?raw";

/** 外管局人民币汇率中间价（日度；含美元/欧元/港元等）；≠房价/挂牌/网签/70城 */
export interface SafeUsdMidRow {
  date: string;
  usdCny: number;
  usdPer100: number;
  /** 100 欧元折合人民币（官网原标价） */
  eurPer100: number;
  /** 100 日元折合人民币 */
  jpyPer100: number;
  /** 100 港元折合人民币 */
  hkdPer100: number;
  /** 100 英镑折合人民币 */
  gbpPer100: number;
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
    eurPer100: n(row.eur_per100),
    jpyPer100: n(row.jpy_per100),
    hkdPer100: n(row.hkd_per100),
    gbpPer100: n(row.gbp_per100),
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

/** 任意币种较上日变动（官网 100 外币标价） */
export function getSafeFxMidDelta(
  key: "eurPer100" | "hkdPer100" | "jpyPer100" | "gbpPer100"
): { prev: number; delta: number } | null {
  if (rows.length < 2) return null;
  const cur = rows[0]![key];
  const prev = rows[1]![key];
  if (!(cur > 0 && prev > 0)) return null;
  return { prev, delta: Math.round((cur - prev) * 10000) / 10000 };
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
