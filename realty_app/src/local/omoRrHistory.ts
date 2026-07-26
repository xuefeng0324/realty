import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/omo_rr_history.csv?raw";

/** 央行公开市场 7 天期逆回购：操作利率，≠房价/挂牌/网签 */
export interface OmoRrRow {
  date: string;
  tenorDays: number;
  ratePct: number;
  amountYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): OmoRrRow {
  return {
    date: String(row.date ?? "").trim(),
    tenorDays: n(row.tenor_days),
    ratePct: n(row.rate_pct),
    amountYi: n(row.amount_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadOmoRrHistoryFromCSV(text: string): OmoRrRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.ratePct > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: OmoRrRow[] = loadOmoRrHistoryFromCSV(String(rawCsv ?? ""));

export function getOmoRrHistory(): OmoRrRow[] {
  return [...rows];
}

export function getLatestOmoRr(): OmoRrRow | null {
  return rows[0] ?? null;
}

export function getOmoRrDeltaVsPrev(): { prev: OmoRrRow; rateDeltaPp: number } | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return { prev, rateDeltaPp: Math.round((cur.ratePct - prev.ratePct) * 100) / 100 };
}

export function __setOmoRrHistoryForTest(next: OmoRrRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
