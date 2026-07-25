import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/sz_planned_supply.csv?raw";

export interface SzPlannedSupplyRow {
  city: string;
  year: number;
  quarter: number;
  asOfDate: string;
  publishDate: string;
  projectCount: number;
  totalUnits: number;
  totalAreaSqm: number;
  residentialUnits: number;
  residentialAreaSqm: number;
  apartmentUnits: number;
  apartmentAreaSqm: number;
  commercialUnits: number;
  commercialAreaSqm: number;
  officeUnits: number;
  officeAreaSqm: number;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SzPlannedSupplyRow {
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    quarter: n(row.quarter),
    asOfDate: String(row.as_of_date ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    projectCount: n(row.project_count),
    totalUnits: n(row.total_units),
    totalAreaSqm: n(row.total_area_sqm),
    residentialUnits: n(row.residential_units),
    residentialAreaSqm: n(row.residential_area_sqm),
    apartmentUnits: n(row.apartment_units),
    apartmentAreaSqm: n(row.apartment_area_sqm),
    commercialUnits: n(row.commercial_units),
    commercialAreaSqm: n(row.commercial_area_sqm),
    officeUnits: n(row.office_units),
    officeAreaSqm: n(row.office_area_sqm),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSzPlannedSupplyFromCSV(text: string): SzPlannedSupplyRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.city === "深圳" && r.year > 0 && r.quarter >= 1 && r.quarter <= 4)
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter);
}

let rows: SzPlannedSupplyRow[] = loadSzPlannedSupplyFromCSV(String(rawCsv ?? ""));

export function getSzPlannedSupplyRows(): SzPlannedSupplyRow[] {
  return [...rows];
}

export function getLatestSzPlannedSupply(): SzPlannedSupplyRow | null {
  return rows[0] ?? null;
}

export function formatSzSupplyPeriod(row: SzPlannedSupplyRow): string {
  return `${row.year} 年 Q${row.quarter}`;
}

/** 相对上一季套数变化；无上季则 null */
export function getSzSupplyQoQDelta(): { prev: SzPlannedSupplyRow; unitsDelta: number; unitsPct: number } | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  const unitsDelta = cur.totalUnits - prev.totalUnits;
  const unitsPct = prev.totalUnits > 0 ? (unitsDelta / prev.totalUnits) * 100 : 0;
  return { prev, unitsDelta, unitsPct };
}

export function __setSzPlannedSupplyRowsForTest(next: SzPlannedSupplyRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
}
