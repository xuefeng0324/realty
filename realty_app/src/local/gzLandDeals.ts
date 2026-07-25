import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gz_land_deals.csv?raw";

export interface GzLandDeal {
  city: string;
  dealDate: string;
  publishDate: string;
  district: string;
  location: string;
  landUse: string;
  areaSqm: number;
  priceWan: number;
  buyer: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GzLandDeal {
  return {
    city: String(row.city ?? "").trim(),
    dealDate: String(row.deal_date ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    district: String(row.district ?? "").trim(),
    location: String(row.location ?? "").trim(),
    landUse: String(row.land_use ?? "").trim(),
    areaSqm: n(row.area_sqm),
    priceWan: n(row.price_wan),
    buyer: String(row.buyer ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGzLandDealsFromCSV(text: string): GzLandDeal[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.city === "广州" && r.areaSqm > 0 && r.priceWan > 0)
    .sort((a, b) => (b.dealDate || "").localeCompare(a.dealDate || "") || b.priceWan - a.priceWan);
}

let rows: GzLandDeal[] = loadGzLandDealsFromCSV(String(rawCsv ?? ""));

export function getGzLandDeals(): GzLandDeal[] {
  return [...rows];
}

export function getLatestGzLandDeals(limit = 5): GzLandDeal[] {
  return rows.slice(0, Math.max(0, limit));
}

export function summarizeGzLandDeals(): {
  count: number;
  totalAreaSqm: number;
  totalPriceWan: number;
  latestDate: string;
  avgSurfaceUnitPriceYuan: number | null;
} | null {
  if (rows.length === 0) return null;
  const totalAreaSqm = rows.reduce((s, r) => s + r.areaSqm, 0);
  const totalPriceWan = rows.reduce((s, r) => s + r.priceWan, 0);
  return {
    count: rows.length,
    totalAreaSqm,
    totalPriceWan,
    latestDate: rows[0]!.dealDate || rows[0]!.publishDate,
    avgSurfaceUnitPriceYuan:
      totalAreaSqm > 0 && totalPriceWan > 0 ? (totalPriceWan * 10000) / totalAreaSqm : null
  };
}

export interface GzLandMonthSummary {
  month: string; // YYYY-MM
  count: number;
  totalAreaSqm: number;
  totalPriceWan: number;
}

/** 按成交月汇总（缺 dealDate 则用 publishDate） */
export function summarizeGzLandDealsByMonth(limit = 6): GzLandMonthSummary[] {
  const map = new Map<string, GzLandMonthSummary>();
  for (const r of rows) {
    const raw = r.dealDate || r.publishDate;
    const month = raw.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const cur = map.get(month) ?? { month, count: 0, totalAreaSqm: 0, totalPriceWan: 0 };
    cur.count += 1;
    cur.totalAreaSqm += r.areaSqm;
    cur.totalPriceWan += r.priceWan;
    map.set(month, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, Math.max(0, limit));
}

/** 楼面地价粗算：成交价(万元)×10000 / 面积㎡ → 元/㎡（不含容积率，仅地表单价参考） */
export function landSurfaceUnitPriceYuan(deal: GzLandDeal): number | null {
  if (deal.areaSqm <= 0 || deal.priceWan <= 0) return null;
  return (deal.priceWan * 10000) / deal.areaSqm;
}

export function __setGzLandDealsForTest(next: GzLandDeal[]): void {
  rows = [...next].sort(
    (a, b) => (b.dealDate || "").localeCompare(a.dealDate || "") || b.priceWan - a.priceWan
  );
}
