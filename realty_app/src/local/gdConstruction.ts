import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_construction.csv?raw";

/** 广东建筑业生产运行简况（资质企业总产值；房屋建筑业≠商品房成交均价） */
export interface GdConstructionRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  totalOutputYi: number;
  totalOutputYoyPct: number;
  housingOutputYi: number;
  housingOutputYoyPct: number;
  civilOutputYi: number;
  civilOutputYoyPct: number;
  prOutputYi: number;
  prOutputYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdConstructionRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    totalOutputYi: n(row.total_output_yi),
    totalOutputYoyPct: n(row.total_output_yoy_pct),
    housingOutputYi: n(row.housing_output_yi),
    housingOutputYoyPct: n(row.housing_output_yoy_pct),
    civilOutputYi: n(row.civil_output_yi),
    civilOutputYoyPct: n(row.civil_output_yoy_pct),
    prOutputYi: n(row.pr_output_yi),
    prOutputYoyPct: n(row.pr_output_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdConstructionFromCSV(text: string): GdConstructionRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdConstructionRow => !!r && r.region === "广东" && r.totalOutputYi > 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdConstructionRow[] = loadGdConstructionFromCSV(String(rawCsv ?? ""));

export function getGdConstructionRows(): GdConstructionRow[] {
  return [...rows];
}

export function getLatestGdConstruction(): GdConstructionRow | null {
  return rows[0] || null;
}

export function getGdConstructionTrend(limit = 6): GdConstructionRow[] {
  return rows.slice(0, Math.max(0, limit));
}

/** 房屋建筑业产值占建筑业总产值比例（%） */
export function gdHousingSharePct(row: GdConstructionRow | null): number | null {
  if (!row || row.totalOutputYi <= 0 || row.housingOutputYi <= 0) return null;
  return Math.round((row.housingOutputYi / row.totalOutputYi) * 1000) / 10;
}

export function __setGdConstructionForTest(next: GdConstructionRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
