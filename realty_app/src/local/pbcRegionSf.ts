import { parseCSV, rowsToObjects } from "./csv";
import { getPbcFinStats } from "./pbcFinStats";
// @ts-ignore
import rawCsv from "../../static/seed/pbc_region_sf.csv?raw";

/** 央行地区社融增量（广东+对照省）：省级流量；≠房价/挂牌/网签 */
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

/** 广东社融增量 ÷ 全国同期社融增量（金融统计报告累计） */
export interface PbcRegionSfVsNational {
  region: PbcRegionSfRow;
  nationalFlowYi: number;
  nationalLabel: string;
  sharePct: number;
}

export const PBC_REGION_SF_FOCUS = "广东";
export const PBC_REGION_SF_PEERS = ["广东", "江苏", "浙江", "北京", "上海"] as const;

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
  const allow = new Set<string>(PBC_REGION_SF_PEERS);
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.period && allow.has(r.region) && r.sfFlowYi > 0)
    .sort((a, b) => b.period.localeCompare(a.period) || a.region.localeCompare(b.region));
}

let rows: PbcRegionSfRow[] = loadPbcRegionSfFromCSV(String(rawCsv ?? ""));

export function getPbcRegionSf(): PbcRegionSfRow[] {
  return [...rows];
}

export function getPbcRegionSfByRegion(region: string = PBC_REGION_SF_FOCUS): PbcRegionSfRow[] {
  return rows.filter((r) => r.region === region);
}

export function getLatestPbcRegionSf(): PbcRegionSfRow | null {
  return getPbcRegionSfByRegion(PBC_REGION_SF_FOCUS)[0] ?? null;
}

export function getPbcRegionSfDeltaVsPrev(): {
  prev: PbcRegionSfRow;
  sfFlowDeltaYi: number;
  rmbLoanDeltaYi: number;
} | null {
  const gd = getPbcRegionSfByRegion(PBC_REGION_SF_FOCUS);
  if (gd.length < 2) return null;
  const cur = gd[0]!;
  const prev = gd[1]!;
  return {
    prev,
    sfFlowDeltaYi: Math.round((cur.sfFlowYi - prev.sfFlowYi) * 100) / 100,
    rmbLoanDeltaYi: Math.round((cur.rmbLoanYi - prev.rmbLoanYi) * 100) / 100
  };
}

function vsNationalFor(row: PbcRegionSfRow): PbcRegionSfVsNational | null {
  const nat = getPbcFinStats().find((r) => r.period === row.period && r.sfFlowYtdWanYi > 0);
  if (!nat) return null;
  const nationalFlowYi = Math.round(nat.sfFlowYtdWanYi * 10000 * 100) / 100;
  if (nationalFlowYi <= 0) return null;
  const sharePct = Math.round((row.sfFlowYi / nationalFlowYi) * 1000) / 10;
  return {
    region: row,
    nationalFlowYi,
    nationalLabel: nat.label || nat.period,
    sharePct
  };
}

export function getPbcRegionSfVsNational(period?: string): PbcRegionSfVsNational | null {
  const gd = getPbcRegionSfByRegion(PBC_REGION_SF_FOCUS);
  const row = period ? gd.find((r) => r.period === period) : gd[0];
  if (!row) return null;
  return vsNationalFor(row);
}

export function listPbcRegionSfVsNational(): PbcRegionSfVsNational[] {
  return getPbcRegionSfByRegion(PBC_REGION_SF_FOCUS)
    .map(vsNationalFor)
    .filter((x): x is PbcRegionSfVsNational => x != null);
}

/** 与广东最新同期对照省，按社融增量降序 */
export function getPbcRegionSfPeerRanking(period?: string): PbcRegionSfRow[] {
  const gd = getLatestPbcRegionSf();
  const p = period ?? gd?.period;
  if (!p) return [];
  return rows
    .filter((r) => r.period === p)
    .sort((a, b) => b.sfFlowYi - a.sfFlowYi || a.region.localeCompare(b.region));
}

export function __setPbcRegionSfForTest(next: PbcRegionSfRow[]): void {
  rows = [...next].sort((a, b) => b.period.localeCompare(a.period) || a.region.localeCompare(b.region));
}
