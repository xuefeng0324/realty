import { parseCSV, rowsToObjects } from "./csv";
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

function mapRow(row: Record<string, string>): EducationOverview {
  return {
    city: String(row.city ?? "").trim(),
    period: String(row.period ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    totalSchools: parseNumber(row.total_schools ?? ""),
    totalStudents10k: parseNumber(row.total_students_10k ?? ""),
    kindergartenCount: parseNumber(row.kindergarten_count ?? ""),
    compulsoryCount: parseNumber(row.compulsory_count ?? ""),
    primaryCount: parseNumber(row.primary_count ?? ""),
    juniorHighCount: parseNumber(row.junior_high_count ?? ""),
    seniorHighCount: parseNumber(row.senior_high_count ?? ""),
    vocationalCount: parseNumber(row.vocational_count ?? ""),
    specialCount: parseNumber(row.special_count ?? ""),
    privateCount: parseNumber(row.private_count ?? ""),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

/** 可测入口：RFC4180 解析（支持字段内逗号） */
export function loadEducationOverviewFromCSV(text: string): EducationOverview[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((row) => row.city);
}

let rows: EducationOverview[] = loadEducationOverviewFromCSV(String(rawCsv ?? ""));

export function getEducationOverview(city: string): EducationOverview | null {
  const key = city.replace(/市$/, "").trim();
  if (!key || key.startsWith("city#")) return null;
  return rows.find((row) => row.city === key) ?? null;
}

export function getEducationOverviews(): EducationOverview[] {
  return [...rows];
}

/** 深圳公报不拆小学/初中；用普通中小学（存于 compulsoryCount）降级展示 */
export function educationHasPrimaryJuniorSplit(row: EducationOverview): boolean {
  return row.primaryCount > 0 && row.juniorHighCount > 0;
}

/**
 * 展示用期间文案。
 * 珠海基础教育表为学年起点年（如 2024 = 2024–2025 学年），不可写成「2024 年」自然年。
 */
export function formatEducationPeriodLabel(row: EducationOverview): string {
  if (row.city === "珠海" && /^\d{4}$/.test(row.period)) {
    const y = Number(row.period);
    return `${y}–${y + 1} 学年`;
  }
  return `${row.period} 年`;
}

/** 测试用：替换内存快照 */
export function __setEducationOverviewRowsForTest(next: EducationOverview[]): void {
  rows = [...next];
}
