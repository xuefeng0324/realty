import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_retail.csv?raw";

/** 国家统计局社消：建筑装潢/家具（≠房价） */
export interface NbsRetailRow {
  month: string;
  publishDate: string;
  retailMonthCny100m: number;
  retailMonthYoyPct: number;
  retailCumCny100m: number;
  retailCumYoyPct: number;
  buildingMonthCny100m: number;
  buildingMonthYoyPct: number;
  buildingCumCny100m: number;
  buildingCumYoyPct: number;
  furnitureMonthCny100m: number;
  furnitureMonthYoyPct: number;
  furnitureCumCny100m: number;
  furnitureCumYoyPct: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): NbsRetailRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    retailMonthCny100m: n(row.retail_month_cny_100m),
    retailMonthYoyPct: n(row.retail_month_yoy_pct),
    retailCumCny100m: n(row.retail_cum_cny_100m),
    retailCumYoyPct: n(row.retail_cum_yoy_pct),
    buildingMonthCny100m: n(row.building_month_cny_100m),
    buildingMonthYoyPct: n(row.building_month_yoy_pct),
    buildingCumCny100m: n(row.building_cum_cny_100m),
    buildingCumYoyPct: n(row.building_cum_yoy_pct),
    furnitureMonthCny100m: n(row.furniture_month_cny_100m),
    furnitureMonthYoyPct: n(row.furniture_month_yoy_pct),
    furnitureCumCny100m: n(row.furniture_cum_cny_100m),
    furnitureCumYoyPct: n(row.furniture_cum_yoy_pct),
    sourceUrl
  };
}

export function loadNbsRetailFromCSV(text: string): NbsRetailRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsRetailRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsRetailRow[] = loadNbsRetailFromCSV(String(rawCsv ?? ""));

export function getNbsRetailRows(): NbsRetailRow[] {
  return [...rows];
}

export function getLatestNbsRetail(): NbsRetailRow | null {
  return rows[0] || null;
}

export function getNbsRetailTrend(limit = 6): NbsRetailRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsRetailMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsRetailForTest(next: NbsRetailRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
