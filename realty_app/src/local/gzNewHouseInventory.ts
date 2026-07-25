import { parseCSV, rowsToObjects } from "./csv";

export interface GzInventoryRow {
  date: string;
  district: string;
  availableUnits: number;
  availableAreaSqm: number;
  unsoldUnits: number;
  unsoldAreaSqm: number;
  signedUnits: number;
  signedAreaSqm: number;
  sourceUrl: string;
}

export interface GzInventoryOverview {
  date: string;
  availableUnits: number;
  unsoldUnits: number;
  signedUnits: number;
  sourceUrl: string;
  districts: GzInventoryRow[];
}

let rows: GzInventoryRow[] = [];

export function loadGzInventoryFromCSV(text: string): GzInventoryRow[] {
  rows = rowsToObjects<Record<string, string>>(parseCSV(text))
    .map((row) => ({
      date: String(row.date ?? "").trim(),
      district: String(row.district ?? "").trim(),
      availableUnits: numberField(row.available_units),
      availableAreaSqm: numberField(row.available_area_sqm),
      unsoldUnits: numberField(row.unsold_units),
      unsoldAreaSqm: numberField(row.unsold_area_sqm),
      signedUnits: numberField(row.signed_units),
      signedAreaSqm: numberField(row.signed_area_sqm),
      sourceUrl: String(row.source_url ?? "").trim()
    }))
    .filter((row) => row.date && row.district)
    .sort((a, b) => b.availableUnits - a.availableUnits);
  return [...rows];
}

export function getGzInventoryOverview(): GzInventoryOverview | null {
  if (rows.length === 0) return null;
  const latestDate = rows.reduce((latest, row) => row.date > latest ? row.date : latest, rows[0].date);
  const latestRows = rows.filter((row) => row.date === latestDate).sort((a, b) => b.availableUnits - a.availableUnits);
  return {
    date: latestDate,
    availableUnits: latestRows.reduce((sum, row) => sum + row.availableUnits, 0),
    unsoldUnits: latestRows.reduce((sum, row) => sum + row.unsoldUnits, 0),
    signedUnits: latestRows.reduce((sum, row) => sum + row.signedUnits, 0),
    sourceUrl: latestRows[0].sourceUrl,
    districts: latestRows
  };
}

function numberField(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
