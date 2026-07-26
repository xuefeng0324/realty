import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/pbc_region_sf.csv?raw";

/** 央行地区社融增量（广东）：省级流量；≠房价/挂牌/网签 */
export interface PbcRegionSfRow {
  period: string;
  label: string;
  region: string;
  sfFlowYi: number;
  rmbLoanYi: number;
  corpBondYi: number;
  govBondYi: number;
  equityYi: number;
  sourceUrl: string;
  xlsxUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): PbcRegionSfRow {
  return {
    period: String(row.period ?? "").trim(),
    label: String(row.label ?? "").trim(),
    region: String(row.region ?? "").trim(),
    sfFlowYi: n(row.sf_flow_yi),
    rmbLoanYi: n(row.rmb_loan_yi),
    corpBondYi: n(row.corp_bond_yi),
    govBondYi: n(row.gov_bond_yi),
    equityYi: n(row.equity_yi),
    sourceUrl: String(row.source_url ?? "").trim(),
    xlsxUrl: String(row.xlsx_url ?? "").trim()
  };
}

export function loadPbcRegionSfFromCSV(text: string): PbcRegionSfRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.period && r.region === "广东" && r.sfFlowYi > 0)
    .sort((a, b) => b.period.localeCompare(a.period));
}

let rows: PbcRegionSfRow[] = loadPbcRegionSfFromCSV(String(rawCsv ?? ""));

export function getPbcRegionSf(): PbcRegionSfRow[] {
  return [...rows];
}

export function getLatestPbcRegionSf(): PbcRegionSfRow | null {
  return rows[0] ?? null;
}

export function getPbcRegionSfDeltaVsPrev(): {
  prev: PbcRegionSfRow;
  sfFlowDeltaYi: number;
  rmbLoanDeltaYi: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    sfFlowDeltaYi: Math.round((cur.sfFlowYi - prev.sfFlowYi) * 100) / 100,
    rmbLoanDeltaYi: Math.round((cur.rmbLoanYi - prev.rmbLoanYi) * 100) / 100
  };
}

export function __setPbcRegionSfForTest(next: PbcRegionSfRow[]): void {
  rows = [...next].sort((a, b) => b.period.localeCompare(a.period));
}
