import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_real_estate_brief.csv?raw";

/** 广东住建厅房地产市场运行简况（全省累计口径，非城市挂牌/网签均价） */
export interface GdRealEstateBriefRow {
  region: string;
  period: string;
  periodLabel: string;
  publishDate: string;
  sortKey: string;
  investmentYi: number;
  investmentYoyPct: number;
  residentialInvestmentYi: number;
  salesAreaWanSqm: number;
  salesAreaYoyPct: number;
  residentialSalesAreaWanSqm: number;
  salesAmountYi: number;
  salesAmountYoyPct: number;
  residentialSalesAmountYi: number;
  constructionAreaWanSqm: number;
  completedAreaWanSqm: number;
  prSalesAreaWanSqm: number;
  prInvestmentYi: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdRealEstateBriefRow | null {
  const period = String(row.period ?? "").trim();
  if (!period) return null;
  return {
    region: String(row.region ?? "").trim(),
    period,
    periodLabel: String(row.period_label ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    sortKey: String(row.sort_key ?? "").trim(),
    investmentYi: n(row.investment_yi),
    investmentYoyPct: n(row.investment_yoy_pct),
    residentialInvestmentYi: n(row.residential_investment_yi),
    salesAreaWanSqm: n(row.sales_area_wan_sqm),
    salesAreaYoyPct: n(row.sales_area_yoy_pct),
    residentialSalesAreaWanSqm: n(row.residential_sales_area_wan_sqm),
    salesAmountYi: n(row.sales_amount_yi),
    salesAmountYoyPct: n(row.sales_amount_yoy_pct),
    residentialSalesAmountYi: n(row.residential_sales_amount_yi),
    constructionAreaWanSqm: n(row.construction_area_wan_sqm),
    completedAreaWanSqm: n(row.completed_area_wan_sqm),
    prSalesAreaWanSqm: n(row.pr_sales_area_wan_sqm),
    prInvestmentYi: n(row.pr_investment_yi),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdRealEstateBriefFromCSV(text: string): GdRealEstateBriefRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdRealEstateBriefRow => !!r && r.region === "广东" && r.salesAreaWanSqm > 0)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

let rows: GdRealEstateBriefRow[] = loadGdRealEstateBriefFromCSV(String(rawCsv ?? ""));

export function getGdRealEstateBriefRows(): GdRealEstateBriefRow[] {
  return [...rows];
}

export function getLatestGdRealEstateBrief(): GdRealEstateBriefRow | null {
  return rows[0] || null;
}

/** 销售额÷销售面积派生全省合同均价（元/㎡）；累计口径，≠城市挂牌均价 */
export function gdBriefImpliedUnitPrice(row: GdRealEstateBriefRow | null): number | null {
  if (!row || row.salesAreaWanSqm <= 0 || row.salesAmountYi <= 0) return null;
  // 亿元 / 万㎡ → 元/㎡ = (yi * 1e8) / (wan * 1e4) = yi / wan * 1e4
  return Math.round((row.salesAmountYi / row.salesAreaWanSqm) * 10000);
}

export function __setGdRealEstateBriefForTest(next: GdRealEstateBriefRow[]): void {
  rows = [...next].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
