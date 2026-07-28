import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_retail.csv?raw";

/** 广东消费品市场运行简况（社消零；≠房价三轴） */
export interface GdRetailRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  retailTotalYi: number;
  retailYoyPct: number;
  urbanYoyPct: number;
  ruralYoyPct: number;
  goodsRetailYoyPct: number;
  cateringYoyPct: number;
  onlineRetailYoyPct: number;
  communicationsYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdRetailRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    retailTotalYi: n(row.retail_total_yi),
    retailYoyPct: n(row.retail_yoy_pct),
    urbanYoyPct: n(row.urban_yoy_pct),
    ruralYoyPct: n(row.rural_yoy_pct),
    goodsRetailYoyPct: n(row.goods_retail_yoy_pct),
    cateringYoyPct: n(row.catering_yoy_pct),
    onlineRetailYoyPct: n(row.online_retail_yoy_pct),
    communicationsYoyPct: n(row.communications_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdRetailFromCSV(text: string): GdRetailRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdRetailRow => !!r && r.region === "广东" && (r.retailYoyPct !== 0 || r.retailTotalYi > 0))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdRetailRow[] = loadGdRetailFromCSV(String(rawCsv ?? ""));

export function getGdRetailRows(): GdRetailRow[] {
  return [...rows];
}

export function getLatestGdRetail(): GdRetailRow | null {
  return rows[0] || null;
}

export function getGdRetailTrend(limit = 6): GdRetailRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setGdRetailForTest(next: GdRetailRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
