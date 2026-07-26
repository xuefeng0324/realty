import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_pmi.csv?raw";

/** 国家统计局采购经理指数（临界点 50）；≠房价 */
export interface NbsPmiRow {
  month: string;
  publishDate: string;
  mfgPmi: number;
  production: number | null;
  newOrders: number | null;
  nonMfgBusiness: number | null;
  constructionBusiness: number | null;
  servicesBusiness: number | null;
  compositePmi: number | null;
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

function mapRow(row: Record<string, string>): NbsPmiRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const mfg = n(row.mfg_pmi);
  if (!(mfg > 0)) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    mfgPmi: mfg,
    production: nOrNull(row.production),
    newOrders: nOrNull(row.new_orders),
    nonMfgBusiness: nOrNull(row.non_mfg_business),
    constructionBusiness: nOrNull(row.construction_business),
    servicesBusiness: nOrNull(row.services_business),
    compositePmi: nOrNull(row.composite_pmi),
    sourceUrl
  };
}

export function loadNbsPmiFromCSV(text: string): NbsPmiRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsPmiRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsPmiRow[] = loadNbsPmiFromCSV(String(rawCsv ?? ""));

export function getNbsPmiRows(): NbsPmiRow[] {
  return [...rows];
}

export function getLatestNbsPmi(): NbsPmiRow | null {
  return rows[0] || null;
}

export function getNbsPmiTrend(limit = 6): NbsPmiRow[] {
  return rows.slice(0, Math.max(0, limit));
}

/** 相对临界点 50 的偏离，供涨跌色 */
export function pmiVsThreshold(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.round((v - 50) * 10) / 10;
}

export function shortNbsPmiMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsPmiForTest(next: NbsPmiRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
