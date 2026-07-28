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
  availableCommercialUnits: number;
  availableCommercialAreaSqm: number;
  unsoldCommercialUnits: number;
  unsoldCommercialAreaSqm: number;
  signedCommercialUnits: number;
  signedCommercialAreaSqm: number;
  availableOfficeUnits: number;
  availableOfficeAreaSqm: number;
  unsoldOfficeUnits: number;
  unsoldOfficeAreaSqm: number;
  signedOfficeUnits: number;
  signedOfficeAreaSqm: number;
  availableParkingUnits: number;
  availableParkingAreaSqm: number;
  unsoldParkingUnits: number;
  unsoldParkingAreaSqm: number;
  signedParkingUnits: number;
  signedParkingAreaSqm: number;
  sourceUrl: string;
}

export interface GzInventoryOverview {
  date: string;
  availableUnits: number;
  unsoldUnits: number;
  signedUnits: number;
  availableCommercialUnits: number;
  unsoldCommercialUnits: number;
  signedCommercialUnits: number;
  availableOfficeUnits: number;
  unsoldOfficeUnits: number;
  signedOfficeUnits: number;
  availableParkingUnits: number;
  unsoldParkingUnits: number;
  signedParkingUnits: number;
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
      availableCommercialUnits: numberField(row.available_commercial_units),
      availableCommercialAreaSqm: numberField(row.available_commercial_area_sqm),
      unsoldCommercialUnits: numberField(row.unsold_commercial_units),
      unsoldCommercialAreaSqm: numberField(row.unsold_commercial_area_sqm),
      signedCommercialUnits: numberField(row.signed_commercial_units),
      signedCommercialAreaSqm: numberField(row.signed_commercial_area_sqm),
      availableOfficeUnits: numberField(row.available_office_units),
      availableOfficeAreaSqm: numberField(row.available_office_area_sqm),
      unsoldOfficeUnits: numberField(row.unsold_office_units),
      unsoldOfficeAreaSqm: numberField(row.unsold_office_area_sqm),
      signedOfficeUnits: numberField(row.signed_office_units),
      signedOfficeAreaSqm: numberField(row.signed_office_area_sqm),
      availableParkingUnits: numberField(row.available_parking_units),
      availableParkingAreaSqm: numberField(row.available_parking_area_sqm),
      unsoldParkingUnits: numberField(row.unsold_parking_units),
      unsoldParkingAreaSqm: numberField(row.unsold_parking_area_sqm),
      signedParkingUnits: numberField(row.signed_parking_units),
      signedParkingAreaSqm: numberField(row.signed_parking_area_sqm),
      sourceUrl: String(row.source_url ?? "").trim()
    }))
    .filter((row) => row.date && row.district)
    .sort((a, b) => b.availableUnits - a.availableUnits);
  return [...rows];
}

function sumLatest(
  latestRows: GzInventoryRow[],
  key: keyof Pick<
    GzInventoryRow,
    | "availableUnits"
    | "unsoldUnits"
    | "signedUnits"
    | "availableCommercialUnits"
    | "unsoldCommercialUnits"
    | "signedCommercialUnits"
    | "availableOfficeUnits"
    | "unsoldOfficeUnits"
    | "signedOfficeUnits"
    | "availableParkingUnits"
    | "unsoldParkingUnits"
    | "signedParkingUnits"
  >
): number {
  return latestRows.reduce((sum, row) => sum + row[key], 0);
}

export function getGzInventoryOverview(): GzInventoryOverview | null {
  if (rows.length === 0) return null;
  const latestDate = rows.reduce((latest, row) => (row.date > latest ? row.date : latest), rows[0].date);
  const latestRows = rows
    .filter((row) => row.date === latestDate)
    .sort((a, b) => b.availableUnits - a.availableUnits);
  return {
    date: latestDate,
    availableUnits: sumLatest(latestRows, "availableUnits"),
    unsoldUnits: sumLatest(latestRows, "unsoldUnits"),
    signedUnits: sumLatest(latestRows, "signedUnits"),
    availableCommercialUnits: sumLatest(latestRows, "availableCommercialUnits"),
    unsoldCommercialUnits: sumLatest(latestRows, "unsoldCommercialUnits"),
    signedCommercialUnits: sumLatest(latestRows, "signedCommercialUnits"),
    availableOfficeUnits: sumLatest(latestRows, "availableOfficeUnits"),
    unsoldOfficeUnits: sumLatest(latestRows, "unsoldOfficeUnits"),
    signedOfficeUnits: sumLatest(latestRows, "signedOfficeUnits"),
    availableParkingUnits: sumLatest(latestRows, "availableParkingUnits"),
    unsoldParkingUnits: sumLatest(latestRows, "unsoldParkingUnits"),
    signedParkingUnits: sumLatest(latestRows, "signedParkingUnits"),
    sourceUrl: latestRows[0].sourceUrl,
    districts: latestRows
  };
}

/** 可售最高区占全市可售比例（%） */
export function topDistrictAvailableSharePct(overview: GzInventoryOverview | null): number | null {
  if (!overview || overview.availableUnits <= 0 || !overview.districts[0]) return null;
  return districtAvailableSharePct(overview.districts[0], overview.availableUnits);
}

/** 单区可售占全市可售比例（%） */
export function districtAvailableSharePct(
  row: Pick<GzInventoryRow, "availableUnits"> | null | undefined,
  cityAvailableUnits: number
): number | null {
  if (!row || cityAvailableUnits <= 0) return null;
  return Math.round((row.availableUnits / cityAvailableUnits) * 1000) / 10;
}

/** 最新日是否含非住宅业态（商业/办公/车位）合计 */
export function gzInventoryHasNonResidential(overview: GzInventoryOverview | null): boolean {
  if (!overview) return false;
  return (
    overview.availableCommercialUnits +
      overview.availableOfficeUnits +
      overview.availableParkingUnits +
      overview.unsoldCommercialUnits +
      overview.unsoldOfficeUnits +
      overview.unsoldParkingUnits >
    0
  );
}

/** 最新日 vs 上一交易日（同 CSV 内）的全市总量差 */
export interface GzInventoryDayDelta {
  prevDate: string;
  availableDelta: number;
  unsoldDelta: number;
  signedDelta: number;
  availableCommercialDelta: number;
  availableOfficeDelta: number;
  availableParkingDelta: number;
}

export function getGzInventoryDayDelta(): GzInventoryDayDelta | null {
  if (rows.length === 0) return null;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length < 2) return null;
  const latest = dates[dates.length - 1]!;
  const prev = dates[dates.length - 2]!;
  const sum = (
    date: string,
    key:
      | "availableUnits"
      | "unsoldUnits"
      | "signedUnits"
      | "availableCommercialUnits"
      | "availableOfficeUnits"
      | "availableParkingUnits"
  ) => rows.filter((r) => r.date === date).reduce((s, r) => s + r[key], 0);
  const prevNonRes =
    sum(prev, "availableCommercialUnits") +
    sum(prev, "availableOfficeUnits") +
    sum(prev, "availableParkingUnits");
  // 历史行可能尚未回填非住宅列：上一交易日合计为 0 时不报虚假日环比
  const nonResReady = prevNonRes > 0;
  return {
    prevDate: prev,
    availableDelta: sum(latest, "availableUnits") - sum(prev, "availableUnits"),
    unsoldDelta: sum(latest, "unsoldUnits") - sum(prev, "unsoldUnits"),
    signedDelta: sum(latest, "signedUnits") - sum(prev, "signedUnits"),
    availableCommercialDelta: nonResReady
      ? sum(latest, "availableCommercialUnits") - sum(prev, "availableCommercialUnits")
      : 0,
    availableOfficeDelta: nonResReady
      ? sum(latest, "availableOfficeUnits") - sum(prev, "availableOfficeUnits")
      : 0,
    availableParkingDelta: nonResReady
      ? sum(latest, "availableParkingUnits") - sum(prev, "availableParkingUnits")
      : 0
  };
}

function numberField(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
