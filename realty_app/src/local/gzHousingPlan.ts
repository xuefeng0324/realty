import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gz_housing_plan.csv?raw";

export interface GzHousingPlanRow {
  city: string;
  year: number;
  publishDate: string;
  approvedPresaleAreaWanSqm: number;
  approvedPresaleUnitsWan: number;
  residentialLandHa: number;
  affordableUnitsWan: number;
  sourceOrg: string;
  sourceUrl: string;
  attachmentUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GzHousingPlanRow {
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    publishDate: String(row.publish_date ?? "").trim(),
    approvedPresaleAreaWanSqm: n(row.approved_presale_area_wan_sqm),
    approvedPresaleUnitsWan: n(row.approved_presale_units_wan),
    residentialLandHa: n(row.residential_land_ha),
    affordableUnitsWan: n(row.affordable_units_wan),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim(),
    attachmentUrl: String(row.attachment_url ?? "").trim()
  };
}

export function loadGzHousingPlanFromCSV(text: string): GzHousingPlanRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.city === "广州" && r.year >= 2000)
    .sort((a, b) => b.year - a.year);
}

let rows: GzHousingPlanRow[] = loadGzHousingPlanFromCSV(String(rawCsv ?? ""));

export function getGzHousingPlanRows(): GzHousingPlanRow[] {
  return [...rows];
}

export function getLatestGzHousingPlan(): GzHousingPlanRow | null {
  return rows[0] ?? null;
}

export function getGzHousingPlanYoY(): {
  prev: GzHousingPlanRow;
  areaDeltaWan: number;
  landDeltaHa: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    areaDeltaWan: cur.approvedPresaleAreaWanSqm - prev.approvedPresaleAreaWanSqm,
    landDeltaHa: cur.residentialLandHa - prev.residentialLandHa
  };
}

export function __setGzHousingPlanRowsForTest(next: GzHousingPlanRow[]): void {
  rows = [...next].sort((a, b) => b.year - a.year);
}
