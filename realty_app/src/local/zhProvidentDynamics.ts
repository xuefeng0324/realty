import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/zh_provident_dynamics.csv?raw";

/** 珠海住房公积金「动态」累计运行摘要（非商品房成交均价） */
export interface ZhProvidentDynamicsRow {
  city: string;
  year: number;
  monthEnd: number;
  asOfDate: string;
  publishDate: string;
  depositAmountYi: number;
  depositYoyPct: number;
  extractAmountYi: number;
  extractYoyPct: number;
  extractRatePct: number;
  loanIssuedYi: number;
  loanIssuedYoyPct: number;
  loanBalanceYi: number;
  loanRatioPct: number;
  paidPersons: number;
  depositBalanceYi: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): ZhProvidentDynamicsRow | null {
  const year = n(row.year);
  const monthEnd = n(row.month_end);
  if (year < 2000 || monthEnd < 1 || monthEnd > 12) return null;
  return {
    city: String(row.city ?? "").trim(),
    year,
    monthEnd,
    asOfDate: String(row.as_of_date ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    depositAmountYi: n(row.deposit_amount_yi),
    depositYoyPct: n(row.deposit_yoy_pct),
    extractAmountYi: n(row.extract_amount_yi),
    extractYoyPct: n(row.extract_yoy_pct),
    extractRatePct: n(row.extract_rate_pct),
    loanIssuedYi: n(row.loan_issued_yi),
    loanIssuedYoyPct: n(row.loan_issued_yoy_pct),
    loanBalanceYi: n(row.loan_balance_yi),
    loanRatioPct: n(row.loan_ratio_pct),
    paidPersons: n(row.paid_persons),
    depositBalanceYi: n(row.deposit_balance_yi),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadZhProvidentDynamicsFromCSV(text: string): ZhProvidentDynamicsRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is ZhProvidentDynamicsRow => !!r && r.city === "珠海" && r.depositAmountYi > 0)
    .sort((a, b) => b.year - a.year || b.monthEnd - a.monthEnd);
}

let rows: ZhProvidentDynamicsRow[] = loadZhProvidentDynamicsFromCSV(String(rawCsv ?? ""));

export function getZhProvidentDynamicsRows(): ZhProvidentDynamicsRow[] {
  return [...rows];
}

/** 最新一期（优先最近年-月末） */
export function getLatestZhProvidentDynamics(): ZhProvidentDynamicsRow | null {
  return rows[0] || null;
}

/** 完整年（month_end=12）最新一期，可作年报近似 */
export function getLatestZhProvidentFullYear(): ZhProvidentDynamicsRow | null {
  return rows.find((r) => r.monthEnd === 12) || null;
}

export function formatZhProvidentPeriod(row: ZhProvidentDynamicsRow | null): string {
  if (!row) return "";
  return row.monthEnd === 12 ? `${row.year} 全年` : `${row.year} 年 1—${row.monthEnd} 月`;
}

export function __setZhProvidentDynamicsForTest(next: ZhProvidentDynamicsRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year || b.monthEnd - a.monthEnd);
}
