import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/mlf_history.csv?raw";

/** 央行中期借贷便利（MLF）：政策操作利率，≠房价/挂牌/网签 */
export interface MlfRow {
  date: string;
  mlf1yPct: number;
  amountYi: number;
  balanceYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): MlfRow {
  return {
    date: String(row.date ?? "").trim(),
    mlf1yPct: n(row.mlf_1y_pct),
    amountYi: n(row.amount_yi),
    balanceYi: n(row.balance_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadMlfHistoryFromCSV(text: string): MlfRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.mlf1yPct > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: MlfRow[] = loadMlfHistoryFromCSV(String(rawCsv ?? ""));

export function getMlfHistory(): MlfRow[] {
  return [...rows];
}

export function getLatestMlf(): MlfRow | null {
  return rows[0] ?? null;
}

export function getMlfDeltaVsPrev(): { prev: MlfRow; rateDeltaPp: number } | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return { prev, rateDeltaPp: Math.round((cur.mlf1yPct - prev.mlf1yPct) * 100) / 100 };
}

export function __setMlfHistoryForTest(next: MlfRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
