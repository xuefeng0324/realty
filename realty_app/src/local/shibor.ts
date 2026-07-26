import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/shibor.csv?raw";

/** Shibor（%）；≠房价/挂牌/网签/70城 */
export interface ShiborRow {
  date: string;
  on: number;
  w1: number;
  w2: number;
  m1: number;
  m3: number;
  m6: number;
  m9: number;
  y1: number;
  source: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): ShiborRow | null {
  const date = String(row.date ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!sourceUrl.includes("chinamoney.com.cn")) return null;
  const on = n(row.on);
  if (!(on > 0)) return null;
  return {
    date,
    on,
    w1: n(row.w1),
    w2: n(row.w2),
    m1: n(row.m1),
    m3: n(row.m3),
    m6: n(row.m6),
    m9: n(row.m9),
    y1: n(row.y1),
    source: String(row.source ?? "").trim(),
    sourceUrl
  };
}

export function loadShiborFromCSV(text: string): ShiborRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is ShiborRow => !!r)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: ShiborRow[] = loadShiborFromCSV(String(rawCsv ?? ""));

export function getShibor(): ShiborRow[] {
  return [...rows];
}

export function getShiborHistory(): ShiborRow[] {
  return getShibor();
}

export function getLatestShibor(): ShiborRow | null {
  return rows[0] ?? null;
}

export function getShiborDeltaVsPrev(): {
  prev: ShiborRow;
  onDeltaPp: number;
  w1DeltaPp: number;
  y1DeltaPp: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    onDeltaPp: Math.round((cur.on - prev.on) * 10000) / 10000,
    w1DeltaPp: Math.round((cur.w1 - prev.w1) * 10000) / 10000,
    y1DeltaPp: Math.round((cur.y1 - prev.y1) * 10000) / 10000
  };
}

export function __setShiborForTest(next: ShiborRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
