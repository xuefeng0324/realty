import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/seed/repo_fixing.csv?raw";

/** 回购定盘 / 银银间回购定盘（%）；≠房价 */
export interface RepoFixingRow {
  date: string;
  fr001: number;
  fr007: number;
  fr014: number;
  fdr001: number;
  fdr007: number;
  fdr014: number;
  source: string;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): RepoFixingRow | null {
  const date = String(row.date ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!sourceUrl.includes("chinamoney.com.cn")) return null;
  const fr007 = n(row.fr007);
  const fdr007 = n(row.fdr007);
  if (!(fr007 > 0 || fdr007 > 0)) return null;
  return {
    date,
    fr001: n(row.fr001),
    fr007,
    fr014: n(row.fr014),
    fdr001: n(row.fdr001),
    fdr007,
    fdr014: n(row.fdr014),
    source: String(row.source ?? "").trim(),
    sourceUrl
  };
}

export function loadRepoFixingFromCSV(text: string): RepoFixingRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is RepoFixingRow => !!r)
    .sort((a, b) => b.date.localeCompare(a.date));
}

let rows: RepoFixingRow[] = loadRepoFixingFromCSV(String(rawCsv ?? ""));

export function getRepoFixing(): RepoFixingRow[] {
  return [...rows];
}

export function getRepoFixingHistory(): RepoFixingRow[] {
  return getRepoFixing();
}

export function getLatestRepoFixing(): RepoFixingRow | null {
  return rows[0] ?? null;
}

export function getRepoFixingDeltaVsPrev(): {
  prev: RepoFixingRow;
  fr007DeltaPp: number;
  fdr007DeltaPp: number;
} | null {
  if (rows.length < 2) return null;
  const cur = rows[0]!;
  const prev = rows[1]!;
  return {
    prev,
    fr007DeltaPp: Math.round((cur.fr007 - prev.fr007) * 10000) / 10000,
    fdr007DeltaPp: Math.round((cur.fdr007 - prev.fdr007) * 10000) / 10000
  };
}

export function __setRepoFixingForTest(next: RepoFixingRow[]): void {
  rows = [...next].sort((a, b) => b.date.localeCompare(a.date));
}
