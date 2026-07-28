import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_industrial.csv?raw";

/** 广东规上工业生产运行简况（增加值同比；≠房价三轴） */
export interface GdIndustrialRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  industryYoyPct: number;
  miningYoyPct: number;
  manufacturingYoyPct: number;
  utilitiesYoyPct: number;
  electronicsYoyPct: number;
  electricalYoyPct: number;
  autoYoyPct: number;
  robotYoyPct: number;
  icYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdIndustrialRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    industryYoyPct: n(row.industry_yoy_pct),
    miningYoyPct: n(row.mining_yoy_pct),
    manufacturingYoyPct: n(row.manufacturing_yoy_pct),
    utilitiesYoyPct: n(row.utilities_yoy_pct),
    electronicsYoyPct: n(row.electronics_yoy_pct),
    electricalYoyPct: n(row.electrical_yoy_pct),
    autoYoyPct: n(row.auto_yoy_pct),
    robotYoyPct: n(row.robot_yoy_pct),
    icYoyPct: n(row.ic_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdIndustrialFromCSV(text: string): GdIndustrialRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdIndustrialRow => !!r && r.region === "广东" && r.industryYoyPct !== 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdIndustrialRow[] = loadGdIndustrialFromCSV(String(rawCsv ?? ""));

export function getGdIndustrialRows(): GdIndustrialRow[] {
  return [...rows];
}

export function getLatestGdIndustrial(): GdIndustrialRow | null {
  return rows[0] || null;
}

export function getGdIndustrialTrend(limit = 6): GdIndustrialRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setGdIndustrialForTest(next: GdIndustrialRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
