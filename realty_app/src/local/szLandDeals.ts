import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/sz_land_deals.csv?raw";

export interface SzLandDeal {
  city: string;
  publishDate: string;
  dealStatus: string;
  district: string;
  location: string;
  landUse: string;
  areaSqm: number;
  /** 列表 API 起始价（万元），非成交总价 */
  startPriceWan: number;
  landNo: string;
  packageCode: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SzLandDeal {
  return {
    city: String(row.city ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    dealStatus: String(row.deal_status ?? "").trim(),
    district: String(row.district ?? "").trim(),
    location: String(row.location ?? "").trim(),
    landUse: String(row.land_use ?? "").trim(),
    areaSqm: n(row.area_sqm),
    startPriceWan: n(row.start_price_wan),
    landNo: String(row.land_no ?? "").trim(),
    packageCode: String(row.package_code ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSzLandDealsFromCSV(text: string): SzLandDeal[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.city === "深圳" && r.areaSqm > 0 && r.startPriceWan > 0)
    .sort(
      (a, b) =>
        (b.publishDate || "").localeCompare(a.publishDate || "") || b.startPriceWan - a.startPriceWan
    );
}

let rows: SzLandDeal[] = loadSzLandDealsFromCSV(String(rawCsv ?? ""));

export function getSzLandDeals(): SzLandDeal[] {
  return [...rows];
}

export function getLatestSzLandDeals(limit = 5): SzLandDeal[] {
  return rows.slice(0, Math.max(0, limit));
}

export function summarizeSzLandDeals(): {
  count: number;
  totalAreaSqm: number;
  totalStartPriceWan: number;
  latestDate: string;
  avgStartSurfaceUnitPriceYuan: number | null;
} | null {
  if (rows.length === 0) return null;
  const totalAreaSqm = rows.reduce((s, r) => s + r.areaSqm, 0);
  const totalStartPriceWan = rows.reduce((s, r) => s + r.startPriceWan, 0);
  return {
    count: rows.length,
    totalAreaSqm,
    totalStartPriceWan,
    latestDate: rows[0]!.publishDate,
    avgStartSurfaceUnitPriceYuan:
      totalAreaSqm > 0 && totalStartPriceWan > 0
        ? (totalStartPriceWan * 10000) / totalAreaSqm
        : null
  };
}

export interface SzLandMonthSummary {
  month: string;
  count: number;
  totalAreaSqm: number;
  totalStartPriceWan: number;
}

export function summarizeSzLandDealsByMonth(limit = 6): SzLandMonthSummary[] {
  const map = new Map<string, SzLandMonthSummary>();
  for (const r of rows) {
    const month = r.publishDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const cur = map.get(month) ?? { month, count: 0, totalAreaSqm: 0, totalStartPriceWan: 0 };
    cur.count += 1;
    cur.totalAreaSqm += r.areaSqm;
    cur.totalStartPriceWan += r.startPriceWan;
    map.set(month, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, Math.max(0, limit));
}

/** 地表单价粗算：起始价(万元)×10000 / 面积㎡ → 元/㎡（不含容积率） */
export function landStartSurfaceUnitPriceYuan(deal: SzLandDeal): number | null {
  if (deal.areaSqm <= 0 || deal.startPriceWan <= 0) return null;
  return (deal.startPriceWan * 10000) / deal.areaSqm;
}

export function __setSzLandDealsForTest(next: SzLandDeal[]): void {
  rows = [...next].sort(
    (a, b) =>
      (b.publishDate || "").localeCompare(a.publishDate || "") || b.startPriceWan - a.startPriceWan
  );
}
