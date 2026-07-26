import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_fa_investment.csv?raw";

/** 国家统计局全国固定资产投资基本情况（不含农户；≠房价/挂牌/70城） */
export interface NbsFaInvestmentRow {
  period: string;
  publishDate: string;
  faCny100m: number;
  faYoyPct: number;
  privateYoyPct: number;
  stateYoyPct: number;
  primaryYoyPct: number;
  secondaryYoyPct: number;
  tertiaryYoyPct: number;
  manufacturingYoyPct: number;
  equipmentYoyPct: number;
  /** 正文「知识产权产品投资」同比；缺失则为 null */
  ipYoyPct: number | null;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function nOpt(v: string | undefined): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const x = Number(s.replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
}

function mapRow(row: Record<string, string>): NbsFaInvestmentRow | null {
  const period = String(row.period ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!period || !sourceUrl.startsWith("https://www.stats.gov.cn/")) return null;
  return {
    period,
    publishDate: String(row.publish_date ?? "").trim(),
    faCny100m: n(row.fa_cny_100m),
    faYoyPct: n(row.fa_yoy_pct),
    privateYoyPct: n(row.private_yoy_pct),
    stateYoyPct: n(row.state_yoy_pct),
    primaryYoyPct: n(row.primary_yoy_pct),
    secondaryYoyPct: n(row.secondary_yoy_pct),
    tertiaryYoyPct: n(row.tertiary_yoy_pct),
    manufacturingYoyPct: n(row.manufacturing_yoy_pct),
    equipmentYoyPct: n(row.equipment_yoy_pct),
    ipYoyPct: nOpt(row.ip_yoy_pct),
    sourceUrl
  };
}

export function loadNbsFaInvestmentFromCSV(text: string): NbsFaInvestmentRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsFaInvestmentRow => !!r && r.faCny100m > 0)
    .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
}

let rows: NbsFaInvestmentRow[] = loadNbsFaInvestmentFromCSV(String(rawCsv ?? ""));

export function getNbsFaInvestmentRows(): NbsFaInvestmentRow[] {
  return [...rows];
}

export function getLatestNbsFaInvestment(): NbsFaInvestmentRow | null {
  return rows[0] || null;
}

export function getNbsFaInvestmentTrend(limit = 6): NbsFaInvestmentRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsFaPeriodLabel(period: string): string {
  const m = period.match(/(\d{4})-01_to_\1-(\d{2})/);
  if (!m) return period;
  return `1—${Number(m[2])}`;
}

export function __setNbsFaInvestmentForTest(next: NbsFaInvestmentRow[]): void {
  rows = [...next].sort((a, b) => b.publishDate.localeCompare(a.publishDate));
}
