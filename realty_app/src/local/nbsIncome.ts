import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_income.csv?raw";

/** 国家统计局居民收入和消费支出（人均元；居住消费 ≠ 房价） */
export interface NbsIncomeRow {
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  disposableYuan: number;
  disposableNominalYoyPct: number;
  disposableRealYoyPct: number;
  urbanDisposableYuan: number;
  urbanNominalYoyPct: number;
  urbanRealYoyPct: number;
  ruralDisposableYuan: number;
  ruralNominalYoyPct: number;
  ruralRealYoyPct: number;
  consumptionYuan: number;
  consumptionNominalYoyPct: number;
  consumptionRealYoyPct: number;
  housingConsumptionYuan: number;
  housingConsumptionYoyPct: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): NbsIncomeRow | null {
  const period = String(row.period ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!period || !sourceUrl.startsWith("https://www.stats.gov.cn/")) return null;
  return {
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    disposableYuan: n(row.disposable_yuan),
    disposableNominalYoyPct: n(row.disposable_nominal_yoy_pct),
    disposableRealYoyPct: n(row.disposable_real_yoy_pct),
    urbanDisposableYuan: n(row.urban_disposable_yuan),
    urbanNominalYoyPct: n(row.urban_nominal_yoy_pct),
    urbanRealYoyPct: n(row.urban_real_yoy_pct),
    ruralDisposableYuan: n(row.rural_disposable_yuan),
    ruralNominalYoyPct: n(row.rural_nominal_yoy_pct),
    ruralRealYoyPct: n(row.rural_real_yoy_pct),
    consumptionYuan: n(row.consumption_yuan),
    consumptionNominalYoyPct: n(row.consumption_nominal_yoy_pct),
    consumptionRealYoyPct: n(row.consumption_real_yoy_pct),
    housingConsumptionYuan: n(row.housing_consumption_yuan),
    housingConsumptionYoyPct: n(row.housing_consumption_yoy_pct),
    sourceUrl
  };
}

export function loadNbsIncomeFromCSV(text: string): NbsIncomeRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsIncomeRow => !!r && r.disposableYuan > 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: NbsIncomeRow[] = loadNbsIncomeFromCSV(String(rawCsv ?? ""));

export function getNbsIncomeRows(): NbsIncomeRow[] {
  return [...rows];
}

export function getLatestNbsIncome(): NbsIncomeRow | null {
  return rows[0] || null;
}

export function getNbsIncomeTrend(limit = 6): NbsIncomeRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function __setNbsIncomeForTest(next: NbsIncomeRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
