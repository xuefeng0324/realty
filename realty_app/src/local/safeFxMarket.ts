import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_fx_market.csv?raw";

/** 外管局中国外汇市场交易概况（万亿）；≠房价/挂牌/网签/70城 */
export interface SafeFxMarketRow {
  date: string;
  totalRmbWanYi: number;
  totalUsdWanYi: number;
  clientRmbWanYi: number;
  interbankRmbWanYi: number;
  spotRmbWanYi: number;
  derivativeRmbWanYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeFxMarketRow {
  return {
    date: String(row.date ?? "").trim(),
    totalRmbWanYi: n(row.total_rmb_wan_yi),
    totalUsdWanYi: n(row.total_usd_wan_yi),
    clientRmbWanYi: n(row.client_rmb_wan_yi),
    interbankRmbWanYi: n(row.interbank_rmb_wan_yi),
    spotRmbWanYi: n(row.spot_rmb_wan_yi),
    derivativeRmbWanYi: n(row.derivative_rmb_wan_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeFxMarketFromCSV(text: string): SafeFxMarketRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.totalRmbWanYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeFxMarketRow[] = loadSafeFxMarketFromCSV(String(rawCsv ?? ""));

export function getSafeFxMarket(): SafeFxMarketRow[] {
  return [...rows];
}

export function getLatestSafeFxMarket(): SafeFxMarketRow | null {
  return rows[0] ?? null;
}

export function getSafeFxMarketDeltaVsPrev(): {
  prev: SafeFxMarketRow;
  totalRmbDeltaWanYi: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    totalRmbDeltaWanYi: Math.round((cur.totalRmbWanYi - prev.totalRmbWanYi) * 100) / 100
  };
}

export function __setSafeFxMarketForTest(next: SafeFxMarketRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
