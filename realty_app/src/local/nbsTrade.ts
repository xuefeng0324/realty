import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_trade.csv?raw";

/** 国家统计局国民经济通稿·货物进出口（海关口径，亿元）；≠房价 */
export interface NbsTradeRow {
  month: string;
  publishDate: string;
  totalMonthYi: number | null;
  totalMonthYoyPct: number | null;
  exportMonthYi: number | null;
  exportMonthYoyPct: number | null;
  importMonthYi: number | null;
  importMonthYoyPct: number | null;
  surplusMonthYi: number | null;
  totalCumYi: number | null;
  totalCumYoyPct: number | null;
  exportCumYi: number | null;
  exportCumYoyPct: number | null;
  importCumYi: number | null;
  importCumYoyPct: number | null;
  surplusCumYi: number | null;
  sourceUrl: string;
}

function nOrNull(v: string | undefined): number | null {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

function mapRow(row: Record<string, string>): NbsTradeRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const totalCum = nOrNull(row.total_cum_yi);
  const totalMonth = nOrNull(row.total_month_yi);
  if (totalCum == null && totalMonth == null) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    totalMonthYi: totalMonth,
    totalMonthYoyPct: nOrNull(row.total_month_yoy_pct),
    exportMonthYi: nOrNull(row.export_month_yi),
    exportMonthYoyPct: nOrNull(row.export_month_yoy_pct),
    importMonthYi: nOrNull(row.import_month_yi),
    importMonthYoyPct: nOrNull(row.import_month_yoy_pct),
    surplusMonthYi: nOrNull(row.surplus_month_yi),
    totalCumYi: totalCum,
    totalCumYoyPct: nOrNull(row.total_cum_yoy_pct),
    exportCumYi: nOrNull(row.export_cum_yi),
    exportCumYoyPct: nOrNull(row.export_cum_yoy_pct),
    importCumYi: nOrNull(row.import_cum_yi),
    importCumYoyPct: nOrNull(row.import_cum_yoy_pct),
    surplusCumYi: nOrNull(row.surplus_cum_yi),
    sourceUrl
  };
}

export function loadNbsTradeFromCSV(text: string): NbsTradeRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsTradeRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsTradeRow[] = loadNbsTradeFromCSV(String(rawCsv ?? ""));

export function getNbsTradeRows(): NbsTradeRow[] {
  return [...rows];
}

export function getLatestNbsTrade(): NbsTradeRow | null {
  return rows[0] || null;
}

export function getNbsTradeTrend(limit = 6): NbsTradeRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsTradeMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsTradeForTest(next: NbsTradeRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
