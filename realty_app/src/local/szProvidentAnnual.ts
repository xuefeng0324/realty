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

export function __setSzProvidentAnnualForTest(next: SzProvidentAnnualRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year);
}
