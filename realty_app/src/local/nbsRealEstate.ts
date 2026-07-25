import { parseCSV, rowsToObjects } from "./csv";

export interface NbsRealEstateSnapshot {
  period: string;
  publishDate: string;
  investmentCny100m: number;
  investmentYoyPct: number;
  salesArea10kSqm: number;
  salesAreaYoyPct: number;
  salesAmountCny100m: number;
  salesAmountYoyPct: number;
  inventoryArea10kSqm: number;
  inventoryAreaYoyPct: number;
  fundsCny100m: number;
  fundsYoyPct: number;
  sourceUrl: string;
}

let snapshots: NbsRealEstateSnapshot[] = [];

const numeric = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`国家统计局房地产字段不是有效数字：${value ?? ""}`);
  return parsed;
};

export function loadNbsRealEstateFromCSV(text: string): NbsRealEstateSnapshot[] {
  snapshots = rowsToObjects<Record<string, string>>(parseCSV(text)).map((row) => {
    const sourceUrl = String(row.source_url ?? "").trim();
    if (!sourceUrl.startsWith("https://www.stats.gov.cn/")) {
      throw new Error(`国家统计局房地产来源链接无效：${sourceUrl}`);
    }
    return {
      period: String(row.period ?? "").trim(),
      publishDate: String(row.publish_date ?? "").trim(),
      investmentCny100m: numeric(row.investment_cny_100m),
      investmentYoyPct: numeric(row.investment_yoy_pct),
      salesArea10kSqm: numeric(row.sales_area_10k_sqm),
      salesAreaYoyPct: numeric(row.sales_area_yoy_pct),
      salesAmountCny100m: numeric(row.sales_amount_cny_100m),
      salesAmountYoyPct: numeric(row.sales_amount_yoy_pct),
      inventoryArea10kSqm: numeric(row.inventory_area_10k_sqm),
      inventoryAreaYoyPct: numeric(row.inventory_area_yoy_pct),
      fundsCny100m: numeric(row.funds_cny_100m),
      fundsYoyPct: numeric(row.funds_yoy_pct),
      sourceUrl
    };
  }).filter((row) => row.period && /^\d{4}-\d{2}-\d{2}$/.test(row.publishDate));
  snapshots.sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  return [...snapshots];
}

export function getLatestNbsRealEstate(): NbsRealEstateSnapshot | null {
  return snapshots[0] ?? null;
}
