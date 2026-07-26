import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_economy.csv?raw";

/** 广东经济运行简况（含 GDP；月度无 GDP 的简况不入库） */
export interface GdEconomyRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  gdpYi: number;
  gdpYoyPct: number;
  primaryVaYi: number;
  primaryYoyPct: number;
  secondaryVaYi: number;
  secondaryYoyPct: number;
  tertiaryVaYi: number;
  tertiaryYoyPct: number;
  industryYoyPct: number;
  retailYoyPct: number;
  faYoyPct: number;
  reInvestmentYoyPct: number;
  cpiYoyPct: number;
  disposableYuan: number;
  disposableNominalYoyPct: number;
  disposableRealYoyPct: number;
  urbanDisposableYuan: number;
  urbanNominalYoyPct: number;
  ruralDisposableYuan: number;
  ruralNominalYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdEconomyRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    gdpYi: n(row.gdp_yi),
    gdpYoyPct: n(row.gdp_yoy_pct),
    primaryVaYi: n(row.primary_va_yi),
    primaryYoyPct: n(row.primary_yoy_pct),
    secondaryVaYi: n(row.secondary_va_yi),
    secondaryYoyPct: n(row.secondary_yoy_pct),
    tertiaryVaYi: n(row.tertiary_va_yi),
    tertiaryYoyPct: n(row.tertiary_yoy_pct),
    industryYoyPct: n(row.industry_yoy_pct),
    retailYoyPct: n(row.retail_yoy_pct),
    faYoyPct: n(row.fa_yoy_pct),
    reInvestmentYoyPct: n(row.re_investment_yoy_pct),
    cpiYoyPct: n(row.cpi_yoy_pct),
    disposableYuan: n(row.disposable_yuan),
    disposableNominalYoyPct: n(row.disposable_nominal_yoy_pct),
    disposableRealYoyPct: n(row.disposable_real_yoy_pct),
    urbanDisposableYuan: n(row.urban_disposable_yuan),
    urbanNominalYoyPct: n(row.urban_nominal_yoy_pct),
    ruralDisposableYuan: n(row.rural_disposable_yuan),
    ruralNominalYoyPct: n(row.rural_nominal_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdEconomyFromCSV(text: string): GdEconomyRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdEconomyRow => !!r && r.region === "广东" && r.gdpYi > 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdEconomyRow[] = loadGdEconomyFromCSV(String(rawCsv ?? ""));

export function getGdEconomyRows(): GdEconomyRow[] {
  return [...rows];
}

export function getLatestGdEconomy(): GdEconomyRow | null {
  return rows[0] || null;
}

export function getGdEconomyTrend(limit = 6): GdEconomyRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setGdEconomyForTest(next: GdEconomyRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
