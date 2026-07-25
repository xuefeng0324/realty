import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/gz_affordable_projects.csv?raw";

export type GzAffordableKind = "raised" | "completed";

/** 广州保障房已筹建/已竣工项目清单汇总（非商品房成交、非房价） */
export interface GzAffordableProjectsRow {
  city: string;
  year: number;
  asOfMonth: number;
  kind: GzAffordableKind;
  category: string;
  projectCount: number;
  totalUnits: number;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
  attachmentUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): GzAffordableProjectsRow | null {
  const kind = String(row.kind ?? "").trim();
  if (kind !== "raised" && kind !== "completed") return null;
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    asOfMonth: n(row.as_of_month),
    kind,
    category: String(row.category ?? "").trim(),
    projectCount: n(row.project_count),
    totalUnits: n(row.total_units),
    title: String(row.title ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim(),
    attachmentUrl: String(row.attachment_url ?? "").trim()
  };
}

export function loadGzAffordableProjectsFromCSV(text: string): GzAffordableProjectsRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is GzAffordableProjectsRow => !!r && r.city === "广州" && r.year >= 2000 && r.totalUnits > 0)
    .sort(
      (a, b) =>
        b.year - a.year ||
        b.asOfMonth - a.asOfMonth ||
        a.kind.localeCompare(b.kind) ||
        a.category.localeCompare(b.category)
    );
}

let rows: GzAffordableProjectsRow[] = loadGzAffordableProjectsFromCSV(String(rawCsv ?? ""));

export function getGzAffordableProjectsRows(): GzAffordableProjectsRow[] {
  return [...rows];
}

/** 优先配售型已筹建，其次保障性住房已筹建 */
export function getLatestGzAffordableRaised(): GzAffordableProjectsRow | null {
  const raised = rows.filter((r) => r.kind === "raised");
  return (
    raised.find((r) => r.category.includes("配售型")) ||
    raised.find((r) => r.category === "保障性住房") ||
    raised[0] ||
    null
  );
}

function categoryFamily(category: string): "sale_type" | "affordable" | "shantytown" | "other" {
  if (category.includes("配售型")) return "sale_type";
  if (category.includes("棚户")) return "shantytown";
  if (category.includes("保障")) return "affordable";
  return "other";
}

/**
 * 已竣工优先与已筹建同口径族（配售型/保障房 vs 棚改），避免并排误读。
 * 同族内再优先 preferYear；配售型可回退到保障性住房竣工。
 */
export function getLatestGzAffordableCompleted(opts?: {
  preferYear?: number;
  preferCategory?: string;
}): GzAffordableProjectsRow | null {
  let done = rows.filter((r) => r.kind === "completed");
  if (!done.length) return null;
  const family = opts?.preferCategory ? categoryFamily(opts.preferCategory) : null;

  if (family === "sale_type" || family === "affordable") {
    const peer = done.filter((r) => {
      const f = categoryFamily(r.category);
      return f === "sale_type" || f === "affordable";
    });
    if (!peer.length) return null;
    done = peer;
  } else if (family === "shantytown") {
    const peer = done.filter((r) => categoryFamily(r.category) === "shantytown");
    if (peer.length) done = peer;
  }

  if (opts?.preferYear) {
    const sameYear = done.filter((r) => r.year === opts.preferYear);
    if (sameYear.length) done = sameYear;
    else if (family) return null;
  }

  if (family === "sale_type") {
    return (
      done.find((r) => r.category.includes("配售型")) ||
      done.find((r) => r.category === "保障性住房") ||
      done[0] ||
      null
    );
  }
  return (
    done.find((r) => r.category === "保障性住房") ||
    done.find((r) => r.category.includes("配售型")) ||
    done[0] ||
    null
  );
}

export function __setGzAffordableProjectsForTest(next: GzAffordableProjectsRow[]): void {
  rows = [...next].sort(
    (a, b) =>
      b.year - a.year ||
      b.asOfMonth - a.asOfMonth ||
      a.kind.localeCompare(b.kind) ||
      a.category.localeCompare(b.category)
  );
}
