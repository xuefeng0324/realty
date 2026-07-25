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

/** 最新日 vs 上一交易日（同 CSV 内）的全市总量差 */
export interface GzInventoryDayDelta {
  prevDate: string;
  availableDelta: number;
  unsoldDelta: number;
  signedDelta: number;
}

export function getGzInventoryDayDelta(): GzInventoryDayDelta | null {
  if (rows.length === 0) return null;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length < 2) return null;
  const latest = dates[dates.length - 1]!;
  const prev = dates[dates.length - 2]!;
  const sum = (date: string, key: "availableUnits" | "unsoldUnits" | "signedUnits") =>
    rows.filter((r) => r.date === date).reduce((s, r) => s + r[key], 0);
  return {
    prevDate: prev,
    availableDelta: sum(latest, "availableUnits") - sum(prev, "availableUnits"),
    unsoldDelta: sum(latest, "unsoldUnits") - sum(prev, "unsoldUnits"),
    signedDelta: sum(latest, "signedUnits") - sum(prev, "signedUnits")
  };
}

function numberField(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
