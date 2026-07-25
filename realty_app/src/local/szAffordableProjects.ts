import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/sz_affordable_projects.csv?raw";

export type SzAffordableKind = "raised" | "completed";

/** 深圳保障房/公共住房建设筹集与基本建成项目表汇总（非商品房成交、非房价） */
export interface SzAffordableProjectsRow {
  city: string;
  year: number;
  kind: SzAffordableKind;
  category: string;
  projectCount: number;
  totalUnits: number;
  /** 建设方式套数（筹集表可拆；建成表通常全计入建设） */
  buildUnits: number;
  /** 筹集方式套数 */
  raiseUnits: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): SzAffordableProjectsRow | null {
  const kind = String(row.kind ?? "").trim();
  if (kind !== "raised" && kind !== "completed") return null;
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    kind,
    category: String(row.category ?? "").trim(),
    projectCount: n(row.project_count),
    totalUnits: n(row.total_units),
    buildUnits: n(row.build_units),
    raiseUnits: n(row.raise_units),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadSzAffordableProjectsFromCSV(text: string): SzAffordableProjectsRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is SzAffordableProjectsRow => !!r && r.city === "深圳" && r.year >= 2000 && r.totalUnits > 0)
    .sort((a, b) => b.year - a.year || a.kind.localeCompare(b.kind) || a.category.localeCompare(b.category));
}

let rows: SzAffordableProjectsRow[] = loadSzAffordableProjectsFromCSV(String(rawCsv ?? ""));

export function getSzAffordableProjectsRows(): SzAffordableProjectsRow[] {
  return [...rows];
}

export function getLatestSzAffordableRaised(): SzAffordableProjectsRow | null {
  return rows.find((r) => r.kind === "raised") ?? null;
}

export function getLatestSzAffordableCompleted(): SzAffordableProjectsRow | null {
  return rows.find((r) => r.kind === "completed") ?? null;
}

export function __setSzAffordableProjectsForTest(next: SzAffordableProjectsRow[]): void {
  rows = [...next].sort(
    (a, b) => b.year - a.year || a.kind.localeCompare(b.kind) || a.category.localeCompare(b.category)
  );
}
