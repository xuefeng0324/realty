import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_service_index.csv?raw";

/** 国家统计局服务业生产指数；租赁商务弱相关≠房价 */
export interface NbsServiceIndexRow {
  month: string;
  publishDate: string;
  indexYoyPct: number;
  indexYtdYoyPct: number | null;
  itYoyPct: number | null;
  leasingYoyPct: number | null;
  financeYoyPct: number | null;
  transportYoyPct: number | null;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function nOrNull(v: string | undefined): number | null {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

function mapRow(row: Record<string, string>): NbsServiceIndexRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    indexYoyPct: n(row.index_yoy_pct),
    indexYtdYoyPct: nOrNull(row.index_ytd_yoy_pct),
    itYoyPct: nOrNull(row.it_yoy_pct),
    leasingYoyPct: nOrNull(row.leasing_yoy_pct),
    financeYoyPct: nOrNull(row.finance_yoy_pct),
    transportYoyPct: nOrNull(row.transport_yoy_pct),
    sourceUrl
  };
}

export function loadNbsServiceIndexFromCSV(text: string): NbsServiceIndexRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsServiceIndexRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsServiceIndexRow[] = loadNbsServiceIndexFromCSV(String(rawCsv ?? ""));

export function getNbsServiceIndexRows(): NbsServiceIndexRow[] {
  return [...rows];
}

export function getLatestNbsServiceIndex(): NbsServiceIndexRow | null {
  return rows[0] || null;
}

export function getNbsServiceIndexTrend(limit = 6): NbsServiceIndexRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsServiceIndexMonthLabel(month: string): string {
  const m = String(month).match(/^20(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : month;
}

export function nbsServiceIndexHasLeasing(row: NbsServiceIndexRow | null): boolean {
  return row?.leasingYoyPct != null;
}

export function __setNbsServiceIndexForTest(next: NbsServiceIndexRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
