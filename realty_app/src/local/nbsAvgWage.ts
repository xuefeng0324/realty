import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_avg_wage.csv?raw";

/** 国家统计局城镇单位就业人员年平均工资；工资≠房价 */
export interface NbsAvgWageRow {
  year: string;
  publishDate: string;
  nonprivYuan: number;
  nonprivNominalYoyPct: number;
  nonprivRealYoyPct: number | null;
  privYuan: number;
  privNominalYoyPct: number;
  privRealYoyPct: number | null;
  reNonprivYuan: number | null;
  reNonprivYoyPct: number | null;
  constructionNonprivYuan: number | null;
  constructionNonprivYoyPct: number | null;
  rePrivYuan: number | null;
  rePrivYoyPct: number | null;
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

function mapRow(row: Record<string, string>): NbsAvgWageRow | null {
  const year = String(row.year ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}$/.test(year) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const nonprivYuan = n(row.nonpriv_yuan);
  if (nonprivYuan <= 0) return null;
  return {
    year,
    publishDate: String(row.publish_date ?? "").trim(),
    nonprivYuan,
    nonprivNominalYoyPct: n(row.nonpriv_nominal_yoy_pct),
    nonprivRealYoyPct: nOrNull(row.nonpriv_real_yoy_pct),
    privYuan: n(row.priv_yuan),
    privNominalYoyPct: n(row.priv_nominal_yoy_pct),
    privRealYoyPct: nOrNull(row.priv_real_yoy_pct),
    reNonprivYuan: nOrNull(row.re_nonpriv_yuan),
    reNonprivYoyPct: nOrNull(row.re_nonpriv_yoy_pct),
    constructionNonprivYuan: nOrNull(row.construction_nonpriv_yuan),
    constructionNonprivYoyPct: nOrNull(row.construction_nonpriv_yoy_pct),
    rePrivYuan: nOrNull(row.re_priv_yuan),
    rePrivYoyPct: nOrNull(row.re_priv_yoy_pct),
    sourceUrl
  };
}

export function loadNbsAvgWageFromCSV(text: string): NbsAvgWageRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsAvgWageRow => !!r)
    .sort((a, b) => b.year.localeCompare(a.year));
}

let rows: NbsAvgWageRow[] = loadNbsAvgWageFromCSV(String(rawCsv ?? ""));

export function getNbsAvgWageRows(): NbsAvgWageRow[] {
  return [...rows];
}

export function getLatestNbsAvgWage(): NbsAvgWageRow | null {
  return rows[0] || null;
}

export function getNbsAvgWageTrend(limit = 6): NbsAvgWageRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function nbsAvgWageHasHousingIndustry(row: NbsAvgWageRow | null): boolean {
  if (!row) return false;
  return row.reNonprivYuan != null || row.constructionNonprivYuan != null;
}

export function __setNbsAvgWageForTest(next: NbsAvgWageRow[]): void {
  rows = [...next].sort((a, b) => b.year.localeCompare(a.year));
}
