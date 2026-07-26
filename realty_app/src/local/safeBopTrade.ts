import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_bop_trade.csv?raw";

/** 外管局国际收支货物和服务贸易（月度，亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeBopTradeRow {
  date: string;
  goodsExportUsdYi: number;
  goodsImportUsdYi: number;
  goodsSurplusUsdYi: number;
  servicesExportUsdYi: number;
  servicesImportUsdYi: number;
  servicesSurplusUsdYi: number;
  totalExportUsdYi: number;
  totalImportUsdYi: number;
  totalSurplusUsdYi: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeBopTradeRow {
  const goodsExportUsdYi = n(row.goods_export_usd_yi);
  const goodsImportUsdYi = n(row.goods_import_usd_yi);
  const goodsSurplusRaw = String(row.goods_surplus_usd_yi ?? "").trim();
  const goodsSurplusUsdYi = goodsSurplusRaw
    ? n(goodsSurplusRaw)
    : goodsExportUsdYi && goodsImportUsdYi
      ? goodsExportUsdYi - goodsImportUsdYi
      : 0;
  const servicesExportUsdYi = n(row.services_export_usd_yi);
  const servicesImportUsdYi = n(row.services_import_usd_yi);
  const servicesSurplusRaw = String(row.services_surplus_usd_yi ?? "").trim();
  const servicesSurplusUsdYi = servicesSurplusRaw
    ? n(servicesSurplusRaw)
    : servicesExportUsdYi && servicesImportUsdYi
      ? servicesExportUsdYi - servicesImportUsdYi
      : 0;
  return {
    date: String(row.date ?? "").trim(),
    goodsExportUsdYi,
    goodsImportUsdYi,
    goodsSurplusUsdYi,
    servicesExportUsdYi,
    servicesImportUsdYi,
    servicesSurplusUsdYi,
    totalExportUsdYi: n(row.total_export_usd_yi),
    totalImportUsdYi: n(row.total_import_usd_yi),
    totalSurplusUsdYi: n(row.total_surplus_usd_yi),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeBopTradeFromCSV(text: string): SafeBopTradeRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && r.totalExportUsdYi > 0 && r.totalImportUsdYi > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeBopTradeRow[] = loadSafeBopTradeFromCSV(String(rawCsv ?? ""));

export function getSafeBopTrade(): SafeBopTradeRow[] {
  return [...rows];
}

export function getLatestSafeBopTrade(): SafeBopTradeRow | null {
  return rows[0] ?? null;
}

export function getSafeBopTradeDeltaVsPrev(): {
  prev: SafeBopTradeRow;
  totalSurplusDelta: number;
  goodsSurplusDelta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    totalSurplusDelta: Math.round((cur.totalSurplusUsdYi - prev.totalSurplusUsdYi) * 100) / 100,
    goodsSurplusDelta: Math.round((cur.goodsSurplusUsdYi - prev.goodsSurplusUsdYi) * 100) / 100
  };
}

export function __setSafeBopTradeForTest(next: SafeBopTradeRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
