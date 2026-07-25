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

/** 优先匹配 preferYear；再优先有目标的配售型筹集行 */
export function getLatestGzAffordableTargetRaised(preferYear?: number): GzAffordableTargetRow | null {
  const raised = rows.filter((r) => r.metric === "raised");
  const pool = preferYear && preferYear > 0 ? raised.filter((r) => r.year === preferYear) : raised;
  const src = pool.length ? pool : raised;
  return (
    src.find((r) => r.targetUnits > 0 && r.category.includes("配售型")) ||
    src.find((r) => r.targetUnits > 0) ||
    src.find((r) => r.category.includes("配售型")) ||
    src[0] ||
    null
  );
}

export function getLatestGzAffordableTargetCompleted(preferYear?: number): GzAffordableTargetRow | null {
  const done = rows.filter((r) => r.metric === "completed");
  const pool = preferYear && preferYear > 0 ? done.filter((r) => r.year === preferYear) : done;
  const src = pool.length ? pool : done;
  return (
    src.find((r) => r.targetUnits > 0 && r.category.includes("配售型")) ||
    src.find((r) => r.targetUnits > 0) ||
    src.find((r) => r.category.includes("配售型")) ||
    src[0] ||
    null
  );
}

/** 任务量完成表无实际时，用同年清单已筹建套数回填进度 */
export function resolveTargetWithProjectsActual(
  target: GzAffordableTargetRow | null,
  actualUnits: number,
  asOfMonth: number
): GzAffordableTargetRow | null {
  if (!target || target.targetUnits <= 0) return null;
  if (target.actualUnits > 0) return target;
  if (actualUnits <= 0) return target;
  return { ...target, actualUnits, asOfMonth: asOfMonth || target.asOfMonth };
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
