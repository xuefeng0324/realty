import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gd_provident_annual.csv?raw";

/** 广东省住房公积金年度报告摘要（全省口径，非城市成交均价） */
export interface GdProvidentAnnualRow {
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
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GdProvidentAnnualRow | null {
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
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadGdProvidentAnnualFromCSV(text: string): GdProvidentAnnualRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GdProvidentAnnualRow => !!r && r.city === "广东" && r.depositAmountYi > 0)
    .sort((a, b) => b.year - a.year);
}

let rows: GdProvidentAnnualRow[] = loadGdProvidentAnnualFromCSV(String(rawCsv ?? ""));

export function getGdProvidentAnnualRows(): GdProvidentAnnualRow[] {
  return [...rows];
}

export function getLatestGdProvidentAnnual(): GdProvidentAnnualRow | null {
  return rows[0] || null;
}

export function gdExtractToDepositPct(row: GdProvidentAnnualRow | null): number | null {
  if (!row || row.depositAmountYi <= 0) return null;
  return Math.round((row.extractAmountYi / row.depositAmountYi) * 1000) / 10;
}

export function gdLoanToDepositBalancePct(row: GdProvidentAnnualRow | null): number | null {
  if (!row || row.depositBalanceYi <= 0) return null;
  return Math.round((row.loanBalanceYi / row.depositBalanceYi) * 1000) / 10;
}

export function __setGdProvidentAnnualForTest(next: GdProvidentAnnualRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year);
}
