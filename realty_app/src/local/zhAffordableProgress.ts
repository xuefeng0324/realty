import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/zh_affordable_progress.csv?raw";

/** 珠海保障性安居工程进展快报（累计至报告期末，非商品房成交/房价） */
export interface ZhAffordableProgressRow {
  city: string;
  year: number;
  month: number;
  reportDate: string;
  planInvestWan: number;
  startedUnits: number;
  startedAreaSqm: number;
  basicallyCompletedUnits: number;
  basicallyCompletedAreaSqm: number;
  completedUnits: number;
  completedAreaSqm: number;
  rentalSubsidyHouseholds: number;
  publicRentalStartedUnits: number;
  publicRentalCompletedUnits: number;
  saleTypeStartedUnits: number;
  saleTypeCompletedUnits: number;
  protectedRentalStartedUnits: number;
  protectedRentalCompletedUnits: number;
  sourceOrg: string;
  sourceUrl: string;
  attachmentUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): ZhAffordableProgressRow {
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    month: n(row.month),
    reportDate: String(row.report_date ?? "").trim(),
    planInvestWan: n(row.plan_invest_wan),
    startedUnits: n(row.started_units),
    startedAreaSqm: n(row.started_area_sqm),
    basicallyCompletedUnits: n(row.basically_completed_units),
    basicallyCompletedAreaSqm: n(row.basically_completed_area_sqm),
    completedUnits: n(row.completed_units),
    completedAreaSqm: n(row.completed_area_sqm),
    rentalSubsidyHouseholds: n(row.rental_subsidy_households),
    publicRentalStartedUnits: n(row.public_rental_started_units),
    publicRentalCompletedUnits: n(row.public_rental_completed_units),
    saleTypeStartedUnits: n(row.sale_type_started_units),
    saleTypeCompletedUnits: n(row.sale_type_completed_units),
    protectedRentalStartedUnits: n(row.protected_rental_started_units),
    protectedRentalCompletedUnits: n(row.protected_rental_completed_units),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim(),
    attachmentUrl: String(row.attachment_url ?? "").trim()
  };
}

export function loadZhAffordableProgressFromCSV(text: string): ZhAffordableProgressRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.city === "珠海" && r.year >= 2000 && r.month >= 1 && r.month <= 12)
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

let rows: ZhAffordableProgressRow[] = loadZhAffordableProgressFromCSV(String(rawCsv ?? ""));

export function getZhAffordableProgressRows(): ZhAffordableProgressRow[] {
  return [...rows];
}

export function getLatestZhAffordableProgress(): ZhAffordableProgressRow | null {
  return rows[0] ?? null;
}

export function getZhAffordableProgressMoM(): {
  prev: ZhAffordableProgressRow;
  startedDelta: number;
  completedDelta: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  // 环比仅同年相邻月，避免跨年累计口径误比
  const prev = rows.find((r) => r.year === cur.year && r.month < cur.month) ?? null;
  if (!prev) return null;
  return {
    prev,
    startedDelta: cur.startedUnits - prev.startedUnits,
    completedDelta: cur.completedUnits - prev.completedUnits
  };
}

export function __setZhAffordableProgressForTest(next: ZhAffordableProgressRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year || b.month - a.month);
}
