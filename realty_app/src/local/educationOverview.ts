// @ts-ignore
import rawCsv from "../../static/education_overview.csv?raw";

export interface EducationOverview {
  city: string;
  period: string;
  publishDate: string;
  totalSchools: number;
  totalStudents10k: number;
  kindergartenCount: number;
  compulsoryCount: number;
  primaryCount: number;
  juniorHighCount: number;
  seniorHighCount: number;
  vocationalCount: number;
  specialCount: number;
  privateCount: number;
  sourceOrg: string;
  sourceUrl: string;
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadRows(): EducationOverview[] {
  const lines = String(rawCsv ?? "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      city: cells[0] ?? "",
      period: cells[1] ?? "",
      publishDate: cells[2] ?? "",
      totalSchools: parseNumber(cells[3]),
      totalStudents10k: parseNumber(cells[4]),
      kindergartenCount: parseNumber(cells[5]),
      compulsoryCount: parseNumber(cells[6]),
      primaryCount: parseNumber(cells[7]),
      juniorHighCount: parseNumber(cells[8]),
      seniorHighCount: parseNumber(cells[9]),
      vocationalCount: parseNumber(cells[10]),
      specialCount: parseNumber(cells[11]),
      privateCount: parseNumber(cells[12]),
      sourceOrg: cells[13] ?? "",
      sourceUrl: cells[14] ?? ""
    };
  });
}

const rows = loadRows();

export function getEducationOverview(city: string): EducationOverview | null {
  return rows.find((row) => row.city === city) ?? null;
}

export function getEducationOverviews(): EducationOverview[] {
  return [...rows];
}

/** 深圳公报不拆小学/初中；用普通中小学（存于 compulsoryCount）降级展示 */
export function educationHasPrimaryJuniorSplit(row: EducationOverview): boolean {
  return row.primaryCount > 0 && row.juniorHighCount > 0;
}
