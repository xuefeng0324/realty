// @ts-ignore
import rawCsv from "../../static/seed/listing_keyword.csv?raw";

export interface ListingKeywordRow {
  cityId: number;
  cityName: string;
  keyword: string;
  count: number;
  share: number;
  medianUnitPrice: number | null;
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadRows(): ListingKeywordRow[] {
  const lines = String(rawCsv ?? "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      cityId: Number(cells[0] ?? 0) || 0,
      cityName: cells[1] ?? "",
      keyword: cells[2] ?? "",
      count: Number(cells[3] ?? 0) || 0,
      share: Number(cells[4] ?? 0) || 0,
      medianUnitPrice: parseNumber(cells[5] ?? "")
    };
  });
}

const rows = loadRows();

export function getListingKeywordsByCity(cityId: number): ListingKeywordRow[] {
  return rows
    .filter((r) => r.cityId === cityId)
    .sort((a, b) => b.share - a.share);
}

export function getListingKeywordsCrossCity(keyword: string): ListingKeywordRow[] {
  return rows
    .filter((r) => r.keyword === keyword)
    .sort((a, b) => b.share - a.share);
}
