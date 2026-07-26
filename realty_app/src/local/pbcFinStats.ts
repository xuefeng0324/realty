import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/pbc_fin_stats.csv?raw";

/** 央行金融统计数据报告：社融/M2/住户贷款结构；≠房价/挂牌/网签 */
export interface PbcFinStatsRow {
  period: string;
  label: string;
  sfStockWanYi: number;
  sfStockYoyPct: number;
  sfFlowYtdWanYi: number;
  m2WanYi: number;
  m2YoyPct: number;
  m1WanYi: number;
  m1YoyPct: number;
  rmbLoanYtdWanYi: number;
  hhLoanYtdYi: number;
  hhMlLoanYtdYi: number;
  ibRepoPct: number;
  forexUsdWanYi: number;
  usdCny: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): PbcFinStatsRow {
  return {
    period: String(row.period ?? "").trim(),
    label: String(row.label ?? "").trim(),
    sfStockWanYi: n(row.sf_stock_wan_yi),
    sfStockYoyPct: n(row.sf_stock_yoy_pct),
    sfFlowYtdWanYi: n(row.sf_flow_ytd_wan_yi),
    m2WanYi: n(row.m2_wan_yi),
    m2YoyPct: n(row.m2_yoy_pct),
    m1WanYi: n(row.m1_wan_yi),
    m1YoyPct: n(row.m1_yoy_pct),
    rmbLoanYtdWanYi: n(row.rmb_loan_ytd_wan_yi),
    hhLoanYtdYi: n(row.hh_loan_ytd_yi),
    hhMlLoanYtdYi: n(row.hh_ml_loan_ytd_yi),
    ibRepoPct: n(row.ib_repo_pct),
    forexUsdWanYi: n(row.forex_usd_wan_yi),
    usdCny: n(row.usd_cny),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadPbcFinStatsFromCSV(text: string): PbcFinStatsRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.period && r.m2WanYi > 0)
    .sort((a, b) => b.period.localeCompare(a.period));
}

let rows: PbcFinStatsRow[] = loadPbcFinStatsFromCSV(String(rawCsv ?? ""));

export function getPbcFinStats(): PbcFinStatsRow[] {
  return [...rows];
}

export function getLatestPbcFinStats(): PbcFinStatsRow | null {
  return rows[0] ?? null;
}

export function getPbcFinStatsDeltaVsPrev(): {
  prev: PbcFinStatsRow;
  sfYoyDeltaPp: number;
  m2YoyDeltaPp: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    sfYoyDeltaPp: Math.round((cur.sfStockYoyPct - prev.sfStockYoyPct) * 100) / 100,
    m2YoyDeltaPp: Math.round((cur.m2YoyPct - prev.m2YoyPct) * 100) / 100
  };
}

export function __setPbcFinStatsForTest(next: PbcFinStatsRow[]): void {
  rows = [...next].sort((a, b) => b.period.localeCompare(a.period));
}
