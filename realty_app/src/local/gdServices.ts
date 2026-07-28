import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_services.csv?raw";

/** 广东规上服务业运行简况（营业收入同比；租赁/房地产服务≠房价三轴） */
export interface GdServicesRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  revenueYoyPct: number;
  transportYoyPct: number;
  itYoyPct: number;
  realEstateSvcYoyPct: number;
  leasingYoyPct: number;
  scienceYoyPct: number;
  environmentYoyPct: number;
  residentSvcYoyPct: number;
  educationYoyPct: number;
  healthYoyPct: number;
  cultureYoyPct: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdServicesRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    revenueYoyPct: n(row.revenue_yoy_pct),
    transportYoyPct: n(row.transport_yoy_pct),
    itYoyPct: n(row.it_yoy_pct),
    realEstateSvcYoyPct: n(row.real_estate_svc_yoy_pct),
    leasingYoyPct: n(row.leasing_yoy_pct),
    scienceYoyPct: n(row.science_yoy_pct),
    environmentYoyPct: n(row.environment_yoy_pct),
    residentSvcYoyPct: n(row.resident_svc_yoy_pct),
    educationYoyPct: n(row.education_yoy_pct),
    healthYoyPct: n(row.health_yoy_pct),
    cultureYoyPct: n(row.culture_yoy_pct),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdServicesFromCSV(text: string): GdServicesRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdServicesRow => !!r && r.region === "广东" && r.revenueYoyPct !== 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdServicesRow[] = loadGdServicesFromCSV(String(rawCsv ?? ""));

export function getGdServicesRows(): GdServicesRow[] {
  return [...rows];
}

export function getLatestGdServices(): GdServicesRow | null {
  return rows[0] || null;
}

export function getGdServicesTrend(limit = 6): GdServicesRow[] {
  return rows.slice(0, Math.max(0, limit));
}

/** 租赁商务或房地产服务（不含开发）分项任一有值 */
export function gdServicesHasHousingRelated(row: GdServicesRow | null): boolean {
  if (!row) return false;
  return row.leasingYoyPct !== 0 || row.realEstateSvcYoyPct !== 0;
}

export function __setGdServicesForTest(next: GdServicesRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
