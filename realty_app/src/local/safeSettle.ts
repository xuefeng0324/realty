import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_settle.csv?raw";

/** 外管局银行结售汇（亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeSettleRow {
  date: string;
  settleUsdYi: number;
  sellUsdYi: number;
  surplusUsdYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeSettleRow {
  const settleUsdYi = n(row.settle_usd_yi);
  const sellUsdYi = n(row.sell_usd_yi);
  const surplusRaw = String(row.surplus_usd_yi ?? "").trim();
  const surplusUsdYi = surplusRaw ? n(surplusRaw) : settleUsdYi - sellUsdYi;
  return {
    date: String(row.date ?? "").trim(),
    settleUsdYi,
    sellUsdYi,
    surplusUsdYi,
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeSettleFromCSV(text: string): SafeSettleRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.settleUsdYi > 0 && r.sellUsdYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeSettleRow[] = loadSafeSettleFromCSV(String(rawCsv ?? ""));

export function getSafeSettle(): SafeSettleRow[] {
  return [...rows];
}

export function getLatestSafeSettle(): SafeSettleRow | null {
  return rows[0] ?? null;
}

export function getSafeSettleDeltaVsPrev(): {
  prev: SafeSettleRow;
  surplusDeltaUsdYi: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    surplusDeltaUsdYi: Math.round((cur.surplusUsdYi - prev.surplusUsdYi) * 100) / 100
  };
}

export function __setSafeSettleForTest(next: SafeSettleRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
