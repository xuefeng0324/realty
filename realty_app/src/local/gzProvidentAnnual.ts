import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gz_provident_annual.csv?raw";

/** 广州住房公积金年度报告摘要（非商品房成交均价） */
export interface GzProvidentAnnualRow {
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

function mapRow(row: Record<string, string>): GzProvidentAnnualRow | null {
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

export function loadGzProvidentAnnualFromCSV(text: string): GzProvidentAnnualRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GzProvidentAnnualRow => !!r && r.city === "广州" && r.loanIssuedWan > 0)
    .sort((a, b) => b.year - a.year);
}

let rows: GzProvidentAnnualRow[] = loadGzProvidentAnnualFromCSV(String(rawCsv ?? ""));

export function getGzProvidentAnnualRows(): GzProvidentAnnualRow[] {
  return [...rows];
}

export function getLatestGzProvidentAnnual(): GzProvidentAnnualRow | null {
  return rows[0] || null;
}

/** 提取额占当年缴存额比例（%） */
export function gzExtractToDepositPct(row: GzProvidentAnnualRow | null): number | null {
  if (!row || row.depositAmountYi <= 0) return null;
  return Math.round((row.extractAmountYi / row.depositAmountYi) * 1000) / 10;
}

/** 个人住房贷款余额 / 缴存余额（%） */
export function gzLoanToDepositBalancePct(row: GzProvidentAnnualRow | null): number | null {
  if (!row || row.depositBalanceYi <= 0) return null;
  return Math.round((row.loanBalanceYi / row.depositBalanceYi) * 1000) / 10;
}

export function __setGzProvidentAnnualForTest(next: GzProvidentAnnualRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year);
}
