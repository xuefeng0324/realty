import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_unemployment.csv?raw";

/** 国家统计局城镇调查失业率；失业率≠房价 */
export interface NbsUnemploymentRow {
  month: string;
  publishDate: string;
  urbanRatePct: number;
  urbanAvgYtdPct: number | null;
  big31RatePct: number | null;
  localHukouRatePct: number | null;
  migrantRatePct: number | null;
  migrantAgriRatePct: number | null;
  weeklyHours: number | null;
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

function mapRow(row: Record<string, string>): NbsUnemploymentRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const urbanRatePct = n(row.urban_rate_pct);
  if (urbanRatePct <= 0) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    urbanRatePct,
    urbanAvgYtdPct: nOrNull(row.urban_avg_ytd_pct),
    big31RatePct: nOrNull(row.big31_rate_pct),
    localHukouRatePct: nOrNull(row.local_hukou_rate_pct),
    migrantRatePct: nOrNull(row.migrant_rate_pct),
    migrantAgriRatePct: nOrNull(row.migrant_agri_rate_pct),
    weeklyHours: nOrNull(row.weekly_hours),
    sourceUrl
  };
}

export function loadNbsUnemploymentFromCSV(text: string): NbsUnemploymentRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsUnemploymentRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsUnemploymentRow[] = loadNbsUnemploymentFromCSV(String(rawCsv ?? ""));

export function getNbsUnemploymentRows(): NbsUnemploymentRow[] {
  return [...rows];
}

export function getLatestNbsUnemployment(): NbsUnemploymentRow | null {
  return rows[0] || null;
}

export function getNbsUnemploymentTrend(limit = 6): NbsUnemploymentRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsUnemploymentMonthLabel(month: string): string {
  const m = String(month).match(/^20(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : month;
}

export function __setNbsUnemploymentForTest(next: NbsUnemploymentRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
