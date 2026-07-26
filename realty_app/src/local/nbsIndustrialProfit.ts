import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_industrial_profit.csv?raw";

/** 国家统计局规上工业企业利润（累计）；≠房价 */
export interface NbsIndustrialProfitRow {
  month: string;
  publishDate: string;
  profitYi: number;
  profitYoyPct: number;
  revenueWanYi: number | null;
  revenueYoyPct: number | null;
  marginPct: number | null;
  miningYoyPct: number | null;
  manufacturingYoyPct: number | null;
  utilitiesYoyPct: number | null;
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

function mapRow(row: Record<string, string>): NbsIndustrialProfitRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const profitYi = n(row.profit_yi);
  if (!(profitYi > 0)) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    profitYi,
    profitYoyPct: n(row.profit_yoy_pct),
    revenueWanYi: nOrNull(row.revenue_wan_yi),
    revenueYoyPct: nOrNull(row.revenue_yoy_pct),
    marginPct: nOrNull(row.margin_pct),
    miningYoyPct: nOrNull(row.mining_yoy_pct),
    manufacturingYoyPct: nOrNull(row.manufacturing_yoy_pct),
    utilitiesYoyPct: nOrNull(row.utilities_yoy_pct),
    sourceUrl
  };
}

export function loadNbsIndustrialProfitFromCSV(text: string): NbsIndustrialProfitRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsIndustrialProfitRow => !!r)
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsIndustrialProfitRow[] = loadNbsIndustrialProfitFromCSV(String(rawCsv ?? ""));

export function getNbsIndustrialProfitRows(): NbsIndustrialProfitRow[] {
  return [...rows];
}

export function getLatestNbsIndustrialProfit(): NbsIndustrialProfitRow | null {
  return rows[0] || null;
}

export function getNbsIndustrialProfitTrend(limit = 6): NbsIndustrialProfitRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function getNbsIndustrialProfitDeltaVsPrev(): {
  prev: NbsIndustrialProfitRow;
  profitYoyDeltaPp: number;
  marginDeltaPp: number | null;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    profitYoyDeltaPp: Math.round((cur.profitYoyPct - prev.profitYoyPct) * 10) / 10,
    marginDeltaPp:
      cur.marginPct != null && prev.marginPct != null
        ? Math.round((cur.marginPct - prev.marginPct) * 100) / 100
        : null
  };
}

export function shortNbsIndustrialProfitMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `1–${Number(m[1])}月` : month;
}

export function __setNbsIndustrialProfitForTest(next: NbsIndustrialProfitRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
