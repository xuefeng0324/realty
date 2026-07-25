import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gz_affordable_targets.csv?raw";

export type GzAffordableTargetMetric = "raised" | "completed";

/** 广州保障房「任务量完成」目标 vs 实际（非商品房成交、非房价） */
export interface GzAffordableTargetRow {
  city: string;
  year: number;
  asOfMonth: number;
  metric: GzAffordableTargetMetric;
  category: string;
  targetUnits: number;
  actualUnits: number;
  actualAreaWanSqm: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
  attachmentUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GzAffordableTargetRow | null {
  const metric = String(row.metric ?? "").trim();
  if (metric !== "raised" && metric !== "completed") return null;
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    asOfMonth: n(row.as_of_month),
    metric,
    category: String(row.category ?? "").trim(),
    targetUnits: n(row.target_units),
    actualUnits: n(row.actual_units),
    actualAreaWanSqm: n(row.actual_area_wan_sqm),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim(),
    attachmentUrl: String(row.attachment_url ?? "").trim()
  };
}

export function loadGzAffordableTargetsFromCSV(text: string): GzAffordableTargetRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter(
      (r): r is GzAffordableTargetRow =>
        !!r && r.city === "广州" && r.year >= 2000 && (r.targetUnits > 0 || r.actualUnits > 0)
    )
    .sort(
      (a, b) =>
        b.year - a.year ||
        b.asOfMonth - a.asOfMonth ||
        a.metric.localeCompare(b.metric) ||
        a.category.localeCompare(b.category)
    );
}

let rows: GzAffordableTargetRow[] = loadGzAffordableTargetsFromCSV(String(rawCsv ?? ""));

export function getGzAffordableTargetRows(): GzAffordableTargetRow[] {
  return [...rows];
}

/** 优先有「目标套数」的筹集行（配售型），否则最新筹集实际 */
export function getLatestGzAffordableTargetRaised(): GzAffordableTargetRow | null {
  const raised = rows.filter((r) => r.metric === "raised");
  return (
    raised.find((r) => r.targetUnits > 0 && r.category.includes("配售型")) ||
    raised.find((r) => r.targetUnits > 0) ||
    raised.find((r) => r.category.includes("配售型")) ||
    raised[0] ||
    null
  );
}

export function getLatestGzAffordableTargetCompleted(): GzAffordableTargetRow | null {
  const done = rows.filter((r) => r.metric === "completed");
  return (
    done.find((r) => r.targetUnits > 0 && r.category.includes("配售型")) ||
    done.find((r) => r.targetUnits > 0) ||
    done.find((r) => r.category.includes("配售型")) ||
    done[0] ||
    null
  );
}

export function progressPct(row: GzAffordableTargetRow | null): number | null {
  if (!row || row.targetUnits <= 0) return null;
  return Math.round((row.actualUnits / row.targetUnits) * 1000) / 10;
}

export function __setGzAffordableTargetsForTest(next: GzAffordableTargetRow[]): void {
  rows = [...next].sort(
    (a, b) =>
      b.year - a.year ||
      b.asOfMonth - a.asOfMonth ||
      a.metric.localeCompare(b.metric) ||
      a.category.localeCompare(b.category)
  );
}
