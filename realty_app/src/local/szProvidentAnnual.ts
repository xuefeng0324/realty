import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/sz_provident_annual.csv?raw";

/** 深圳住房公积金年度报告摘要（非商品房成交均价） */
export interface SzProvidentAnnualRow {
  city: string;
  year: number;
  publishDate: string;
  paidUnitsWan: number;
  paidPersonsWan: number;
  depositAmountYi: number;
  depositBalanceYi: number;
  extractAmountYi: number;
  loanIssuedWan: number;
  loanIssuedYi: number;
  loanBalanceYi: number;
  supportPurchaseWanSqm: number;
  publicRentalSupplementYi: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SzProvidentAnnualRow | null {
  const year = n(row.year);
  if (year < 2000) return null;
  return {
    city: String(row.city ?? "").trim(),
    year,
    publishDate: String(row.publish_date ?? "").trim(),
    paidUnitsWan: n(row.paid_units_wan),
    paidPersonsWan: n(row.paid_persons_wan),
    depositAmountYi: n(row.deposit_amount_yi),
    depositBalanceYi: n(row.deposit_balance_yi),
    extractAmountYi: n(row.extract_amount_yi),
    loanIssuedWan: n(row.loan_issued_wan),
    loanIssuedYi: n(row.loan_issued_yi),
    loanBalanceYi: n(row.loan_balance_yi),
    supportPurchaseWanSqm: n(row.support_purchase_wan_sqm),
    publicRentalSupplementYi: n(row.public_rental_supplement_yi),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSzProvidentAnnualFromCSV(text: string): SzProvidentAnnualRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is SzProvidentAnnualRow => !!r && r.city === "深圳" && r.loanIssuedWan > 0)
    .sort((a, b) => b.year - a.year);
}

let rows: SzProvidentAnnualRow[] = loadSzProvidentAnnualFromCSV(String(rawCsv ?? ""));

export function getSzProvidentAnnualRows(): SzProvidentAnnualRow[] {
  return [...rows];
}

export function getLatestSzProvidentAnnual(): SzProvidentAnnualRow | null {
  return rows[0] || null;
}

export function getSzProvidentAnnualByYear(year: number): SzProvidentAnnualRow | null {
  return rows.find((r) => r.year === year) || null;
}

/** 最新年报的上一年（用于同比对照） */
export function getSzProvidentPriorYear(
  cur: SzProvidentAnnualRow | null = getLatestSzProvidentAnnual()
): SzProvidentAnnualRow | null {
  if (!cur) return null;
  return getSzProvidentAnnualByYear(cur.year - 1);
}

export interface SzProvidentYearDelta {
  prior: SzProvidentAnnualRow;
  depositDeltaYi: number;
  loanDeltaYi: number;
  supportDeltaWanSqm: number;
  loanIssuedWanDelta: number;
}

export function getSzProvidentYearDelta(
  cur: SzProvidentAnnualRow | null = getLatestSzProvidentAnnual()
): SzProvidentYearDelta | null {
  const prior = getSzProvidentPriorYear(cur);
  if (!cur || !prior) return null;
  return {
    prior,
    depositDeltaYi: Math.round((cur.depositAmountYi - prior.depositAmountYi) * 100) / 100,
    loanDeltaYi: Math.round((cur.loanIssuedYi - prior.loanIssuedYi) * 100) / 100,
    supportDeltaWanSqm: Math.round((cur.supportPurchaseWanSqm - prior.supportPurchaseWanSqm) * 100) / 100,
    loanIssuedWanDelta: Math.round((cur.loanIssuedWan - prior.loanIssuedWan) * 100) / 100
  };
}

/** 提取额占当年缴存额比例（%） */
export function extractToDepositPct(row: SzProvidentAnnualRow | null): number | null {
  if (!row || row.depositAmountYi <= 0) return null;
  return Math.round((row.extractAmountYi / row.depositAmountYi) * 1000) / 10;
}

/** 个人住房贷款余额 / 缴存余额（%） */
export function loanToDepositBalancePct(row: SzProvidentAnnualRow | null): number | null {
  if (!row || row.depositBalanceYi <= 0) return null;
  return Math.round((row.loanBalanceYi / row.depositBalanceYi) * 1000) / 10;
}

export function __setSzProvidentAnnualForTest(next: SzProvidentAnnualRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year);
}
