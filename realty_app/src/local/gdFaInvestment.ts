import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_fa_investment.csv?raw";

/** 广东固定资产投资运行简况（名义同比；官方正文通常无绝对额） */
export interface GdFaInvestmentRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  faYoyPct: number;
  primaryYoyPct: number;
  secondaryYoyPct: number;
  tertiaryYoyPct: number;
  industryYoyPct: number;
  manufacturingYoyPct: number;
  prYoyPct: number;
  eastYoyPct: number;
  westYoyPct: number;
  northYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdFaInvestmentRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    faYoyPct: n(row.fa_yoy_pct),
    primaryYoyPct: n(row.primary_yoy_pct),
    secondaryYoyPct: n(row.secondary_yoy_pct),
    tertiaryYoyPct: n(row.tertiary_yoy_pct),
    industryYoyPct: n(row.industry_yoy_pct),
    manufacturingYoyPct: n(row.manufacturing_yoy_pct),
    prYoyPct: n(row.pr_yoy_pct),
    eastYoyPct: n(row.east_yoy_pct),
    westYoyPct: n(row.west_yoy_pct),
    northYoyPct: n(row.north_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdFaInvestmentFromCSV(text: string): GdFaInvestmentRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdFaInvestmentRow => !!r && r.region === "广东" && r.faYoyPct !== 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdFaInvestmentRow[] = loadGdFaInvestmentFromCSV(String(rawCsv ?? ""));

export function getGdFaInvestmentRows(): GdFaInvestmentRow[] {
  return [...rows];
}

export function getLatestGdFaInvestment(): GdFaInvestmentRow | null {
  return rows[0] || null;
}

export function getGdFaInvestmentTrend(limit = 6): GdFaInvestmentRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setGdFaInvestmentForTest(next: GdFaInvestmentRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
