import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_gdp.csv?raw";

/** 国家统计局季度 GDP 初步核算；行业增加值≠房价 */
export interface NbsGdpRow {
  period: string;
  label: string;
  publishDate: string;
  gdpYiYuan: number;
  gdpYoyPct: number;
  primaryYiYuan: number;
  primaryYoyPct: number;
  secondaryYiYuan: number;
  secondaryYoyPct: number;
  tertiaryYiYuan: number;
  tertiaryYoyPct: number;
  industryYiYuan: number;
  industryYoyPct: number;
  constructionYiYuan: number;
  constructionYoyPct: number;
  realEstateYiYuan: number;
  realEstateYoyPct: number;
  quarterGdpYiYuan: number | null;
  quarterGdpYoyPct: number | null;
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

function periodSortKey(period: string): [number, number] {
  const m = String(period).match(/^(20\d{2})(?:-(Q1|H1|9M))?$/);
  if (!m) return [0, 0];
  const year = Number(m[1]);
  const order: Record<string, number> = { Q1: 1, H1: 2, "9M": 3 };
  return [year, m[2] ? order[m[2]] ?? 0 : 4];
}

function mapRow(row: Record<string, string>): NbsGdpRow | null {
  const period = String(row.period ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!period || !sourceUrl.startsWith("https://www.stats.gov.cn/")) return null;
  const gdpYiYuan = n(row.gdp_yi_yuan);
  if (gdpYiYuan <= 0) return null;
  return {
    period,
    label: String(row.label ?? "").trim() || period,
    publishDate: String(row.publish_date ?? "").trim(),
    gdpYiYuan,
    gdpYoyPct: n(row.gdp_yoy_pct),
    primaryYiYuan: n(row.primary_yi_yuan),
    primaryYoyPct: n(row.primary_yoy_pct),
    secondaryYiYuan: n(row.secondary_yi_yuan),
    secondaryYoyPct: n(row.secondary_yoy_pct),
    tertiaryYiYuan: n(row.tertiary_yi_yuan),
    tertiaryYoyPct: n(row.tertiary_yoy_pct),
    industryYiYuan: n(row.industry_yi_yuan),
    industryYoyPct: n(row.industry_yoy_pct),
    constructionYiYuan: n(row.construction_yi_yuan),
    constructionYoyPct: n(row.construction_yoy_pct),
    realEstateYiYuan: n(row.real_estate_yi_yuan),
    realEstateYoyPct: n(row.real_estate_yoy_pct),
    quarterGdpYiYuan: nOrNull(row.quarter_gdp_yi_yuan),
    quarterGdpYoyPct: nOrNull(row.quarter_gdp_yoy_pct),
    sourceUrl
  };
}

export function loadNbsGdpFromCSV(text: string): NbsGdpRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsGdpRow => !!r)
    .sort((a, b) => {
      const [ay, ao] = periodSortKey(a.period);
      const [by, bo] = periodSortKey(b.period);
      if (by !== ay) return by - ay;
      return bo - ao;
    });
}

let rows: NbsGdpRow[] = loadNbsGdpFromCSV(String(rawCsv ?? ""));

export function getNbsGdpRows(): NbsGdpRow[] {
  return [...rows];
}

export function getLatestNbsGdp(): NbsGdpRow | null {
  return rows[0] || null;
}

export function getNbsGdpTrend(limit = 6): NbsGdpRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsGdpPeriodLabel(period: string): string {
  const m = String(period).match(/^(20\d{2})(?:-(Q1|H1|9M))?$/);
  if (!m) return period;
  if (!m[2]) return `${m[1].slice(2)}全年`;
  const map: Record<string, string> = { Q1: "Q1", H1: "H1", "9M": "前三季" };
  return `${m[1].slice(2)}${map[m[2]]}`;
}

export function __setNbsGdpForTest(next: NbsGdpRow[]): void {
  rows = loadNbsGdpFromCSV(
    [
      "period,label,publish_date,gdp_yi_yuan,gdp_yoy_pct,primary_yi_yuan,primary_yoy_pct,secondary_yi_yuan,secondary_yoy_pct,tertiary_yi_yuan,tertiary_yoy_pct,industry_yi_yuan,industry_yoy_pct,construction_yi_yuan,construction_yoy_pct,real_estate_yi_yuan,real_estate_yoy_pct,quarter_gdp_yi_yuan,quarter_gdp_yoy_pct,source_url",
      ...next.map(
        (r) =>
          [
            r.period,
            r.label,
            r.publishDate,
            r.gdpYiYuan,
            r.gdpYoyPct,
            r.primaryYiYuan,
            r.primaryYoyPct,
            r.secondaryYiYuan,
            r.secondaryYoyPct,
            r.tertiaryYiYuan,
            r.tertiaryYoyPct,
            r.industryYiYuan,
            r.industryYoyPct,
            r.constructionYiYuan,
            r.constructionYoyPct,
            r.realEstateYiYuan,
            r.realEstateYoyPct,
            r.quarterGdpYiYuan ?? "",
            r.quarterGdpYoyPct ?? "",
            r.sourceUrl
          ].join(",")
      )
    ].join("\n")
  );
}
