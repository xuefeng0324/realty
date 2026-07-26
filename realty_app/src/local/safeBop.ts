import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/safe_bop.csv?raw";

/** 外管局国际收支平衡表（季度流量，亿美元）；≠房价/挂牌/网签/70城 */
export interface SafeBopRow {
  date: string;
  currentAccountUsdYi: number;
  goodsSurplusUsdYi: number;
  servicesSurplusUsdYi: number;
  primaryIncomeUsdYi: number;
  secondaryIncomeUsdYi: number;
  capitalFinancialUsdYi: number;
  isPreliminary: boolean;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SafeBopRow {
  return {
    date: String(row.date ?? "").trim(),
    currentAccountUsdYi: n(row.current_account_usd_yi),
    goodsSurplusUsdYi: n(row.goods_surplus_usd_yi),
    servicesSurplusUsdYi: n(row.services_surplus_usd_yi),
    primaryIncomeUsdYi: n(row.primary_income_usd_yi),
    secondaryIncomeUsdYi: n(row.secondary_income_usd_yi),
    capitalFinancialUsdYi: n(row.capital_financial_usd_yi),
    isPreliminary: String(row.is_preliminary ?? "").trim() === "1",
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSafeBopFromCSV(text: string): SafeBopRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.date && (r.currentAccountUsdYi !== 0 || r.goodsSurplusUsdYi !== 0))
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: SafeBopRow[] = loadSafeBopFromCSV(String(rawCsv ?? ""));

export function getSafeBop(): SafeBopRow[] {
  return [...rows];
}

export function getLatestSafeBop(): SafeBopRow | null {
  return rows[0] ?? null;
}

export function getSafeBopDeltaVsPrev(): {
  prev: SafeBopRow;
  currentAccountDelta: number;
  capitalFinancialDelta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    currentAccountDelta:
      Math.round((cur.currentAccountUsdYi - prev.currentAccountUsdYi) * 100) / 100,
    capitalFinancialDelta:
      Math.round((cur.capitalFinancialUsdYi - prev.capitalFinancialUsdYi) * 100) / 100
  };
}

export function __setSafeBopForTest(next: SafeBopRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
