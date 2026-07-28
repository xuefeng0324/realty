import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_ppi.csv?raw";

/** 国家统计局月度 PPI（建材/黑色金属分项 ≠ 房价） */
export interface NbsPpiRow {
  month: string;
  publishDate: string;
  ppiYoyPct: number;
  ppiMomPct: number;
  purchaseYoyPct: number;
  nonMetalYoyPct: number;
  /** 购进：建筑材料及非金属类同比% */
  buildingMaterialsYoyPct: number | null;
  /** 出厂：黑色金属冶炼和压延加工业同比% */
  ferrousSmeltingYoyPct: number | null;
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

function mapRow(row: Record<string, string>): NbsPpiRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    ppiYoyPct: n(row.ppi_yoy_pct),
    ppiMomPct: n(row.ppi_mom_pct),
    purchaseYoyPct: n(row.purchase_yoy_pct),
    nonMetalYoyPct: n(row.non_metal_yoy_pct),
    buildingMaterialsYoyPct: nOrNull(row.building_materials_yoy_pct),
    ferrousSmeltingYoyPct: nOrNull(row.ferrous_smelting_yoy_pct),
    sourceUrl
  };
}

export function loadNbsPpiFromCSV(text: string): NbsPpiRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsPpiRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsPpiRow[] = loadNbsPpiFromCSV(String(rawCsv ?? ""));

export function getNbsPpiRows(): NbsPpiRow[] {
  return [...rows];
}

export function getLatestNbsPpi(): NbsPpiRow | null {
  return rows[0] || null;
}

export function getNbsPpiTrend(limit = 6): NbsPpiRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function nbsPpiHasBuildingMaterials(row: NbsPpiRow | null): boolean {
  if (!row) return false;
  return row.buildingMaterialsYoyPct != null || row.ferrousSmeltingYoyPct != null;
}

export function shortNbsPpiMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsPpiForTest(next: NbsPpiRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
