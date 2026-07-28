import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_industrial.csv?raw";

/** 国家统计局规上工业增加值（%）；附水泥/钢材/玻璃产量；≠房价 */
export interface NbsIndustrialRow {
  month: string;
  publishDate: string;
  yoyPct: number;
  momPct: number | null;
  ytdYoyPct: number | null;
  miningYoyPct: number | null;
  manufacturingYoyPct: number | null;
  utilitiesYoyPct: number | null;
  cementWanT: number | null;
  cementYoyPct: number | null;
  cementYtdYoyPct: number | null;
  flatGlassWanWeightBox: number | null;
  flatGlassYoyPct: number | null;
  steelWanT: number | null;
  steelYoyPct: number | null;
  crudeSteelWanT: number | null;
  crudeSteelYoyPct: number | null;
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

function mapRow(row: Record<string, string>): NbsIndustrialRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const yoy = n(row.yoy_pct);
  if (!Number.isFinite(yoy)) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    yoyPct: yoy,
    momPct: nOrNull(row.mom_pct),
    ytdYoyPct: nOrNull(row.ytd_yoy_pct),
    miningYoyPct: nOrNull(row.mining_yoy_pct),
    manufacturingYoyPct: nOrNull(row.manufacturing_yoy_pct),
    utilitiesYoyPct: nOrNull(row.utilities_yoy_pct),
    cementWanT: nOrNull(row.cement_wan_t),
    cementYoyPct: nOrNull(row.cement_yoy_pct),
    cementYtdYoyPct: nOrNull(row.cement_ytd_yoy_pct),
    flatGlassWanWeightBox: nOrNull(row.flat_glass_wan_weight_box),
    flatGlassYoyPct: nOrNull(row.flat_glass_yoy_pct),
    steelWanT: nOrNull(row.steel_wan_t),
    steelYoyPct: nOrNull(row.steel_yoy_pct),
    crudeSteelWanT: nOrNull(row.crude_steel_wan_t),
    crudeSteelYoyPct: nOrNull(row.crude_steel_yoy_pct),
    sourceUrl
  };
}

export function loadNbsIndustrialFromCSV(text: string): NbsIndustrialRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsIndustrialRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsIndustrialRow[] = loadNbsIndustrialFromCSV(String(rawCsv ?? ""));

export function getNbsIndustrialRows(): NbsIndustrialRow[] {
  return [...rows];
}

export function getLatestNbsIndustrial(): NbsIndustrialRow | null {
  return rows[0] || null;
}

export function getNbsIndustrialTrend(limit = 6): NbsIndustrialRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function getNbsIndustrialDeltaVsPrev(): {
  prev: NbsIndustrialRow;
  yoyDeltaPp: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    yoyDeltaPp: Math.round((cur.yoyPct - prev.yoyPct) * 10) / 10
  };
}

export function nbsIndustrialHasBuildingMaterials(row: NbsIndustrialRow | null): boolean {
  if (!row) return false;
  return row.cementYoyPct != null || row.steelYoyPct != null || row.flatGlassYoyPct != null;
}

export function shortNbsIndustrialMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsIndustrialForTest(next: NbsIndustrialRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
