import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_cpi.csv?raw";

/** 国家统计局月度 CPI（居住/房租同比 ≠ 房价） */
export interface NbsCpiRow {
  month: string;
  publishDate: string;
  cpiYoyPct: number;
  cpiMomPct: number;
  residenceYoyPct: number;
  rentYoyPct: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): NbsCpiRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    cpiYoyPct: n(row.cpi_yoy_pct),
    cpiMomPct: n(row.cpi_mom_pct),
    residenceYoyPct: n(row.residence_yoy_pct),
    rentYoyPct: n(row.rent_yoy_pct),
    sourceUrl
  };
}

export function loadNbsCpiFromCSV(text: string): NbsCpiRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsCpiRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsCpiRow[] = loadNbsCpiFromCSV(String(rawCsv ?? ""));

export function getNbsCpiRows(): NbsCpiRow[] {
  return [...rows];
}

export function getLatestNbsCpi(): NbsCpiRow | null {
  return rows[0] || null;
}

export function getNbsCpiTrend(limit = 6): NbsCpiRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsCpiMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsCpiForTest(next: NbsCpiRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
