import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_iip.csv?raw";

/** 外管局国际投资头寸（季末，亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeIipRow {
  date: string;
  assetsUsdYi: number;
  liabilitiesUsdYi: number;
  netUsdYi: number;
  fdiAssetsUsdYi: number;
  portfolioAssetsUsdYi: number;
  otherAssetsUsdYi: number;
  reserveAssetsUsdYi: number;
  fdiLiabUsdYi: number;
  portfolioLiabUsdYi: number;
  otherLiabUsdYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeIipRow {
  return {
    date: String(row.date ?? "").trim(),
    assetsUsdYi: n(row.assets_usd_yi),
    liabilitiesUsdYi: n(row.liabilities_usd_yi),
    netUsdYi: n(row.net_usd_yi),
    fdiAssetsUsdYi: n(row.fdi_assets_usd_yi),
    portfolioAssetsUsdYi: n(row.portfolio_assets_usd_yi),
    otherAssetsUsdYi: n(row.other_assets_usd_yi),
    reserveAssetsUsdYi: n(row.reserve_assets_usd_yi),
    fdiLiabUsdYi: n(row.fdi_liab_usd_yi),
    portfolioLiabUsdYi: n(row.portfolio_liab_usd_yi),
    otherLiabUsdYi: n(row.other_liab_usd_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeIipFromCSV(text: string): SafeIipRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.assetsUsdYi > 0 && r.liabilitiesUsdYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeIipRow[] = loadSafeIipFromCSV(String(rawCsv ?? ""));

export function getSafeIip(): SafeIipRow[] {
  return [...rows];
}

export function getLatestSafeIip(): SafeIipRow | null {
  return rows[0] ?? null;
}

export function getSafeIipDeltaVsPrev(): {
  prev: SafeIipRow;
  netDelta: number;
  assetsDelta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    netDelta: Math.round((cur.netUsdYi - prev.netUsdYi) * 100) / 100,
    assetsDelta: Math.round((cur.assetsUsdYi - prev.assetsUsdYi) * 100) / 100
  };
}

/** 净资产 / 总资产（%） */
export function getSafeIipNetShare(row?: SafeIipRow | null): number | null {
  const r = row ?? rows[0];
  if (!r || !(r.assetsUsdYi > 0)) return null;
  return Math.round((r.netUsdYi / r.assetsUsdYi) * 10000) / 100;
}

export function __setSafeIipForTest(next: SafeIipRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
