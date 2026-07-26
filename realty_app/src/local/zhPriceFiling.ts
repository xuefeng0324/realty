import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/zh_price_filing.csv?raw";

/**
 * 珠海商品房价格备案公示（住建局 HTML 表摘要）。
 * 口径：政府备案销售均价（建筑面积 / 套内）；≠ 挂牌价、≠ 成交价、≠ 网签、≠ 70城。
 */
export interface ZhPriceFilingRow {
  postId: string;
  publishDate: string;
  updatedDate: string;
  projectName: string;
  address: string;
  /** 从地址推断：香洲区 / 金湾区 / 斗门区 / 高新区 / 横琴 / 其他 */
  district: string;
  units: number;
  areaSqm: number;
  avgPriceBuilding: number;
  avgPriceInner: number;
  listTitle: string;
  sourceOrg: string;
  sourceUrl: string;
}

export interface ZhPriceFilingDistrictStat {
  district: string;
  filingCount: number;
  units: number;
  medianAvgPriceBuilding: number | null;
}

export interface ZhPriceFilingSummary {
  filingCount: number;
  totalUnits: number;
  medianAvgPriceBuilding: number | null;
  /** 按套数加权的建筑面积均价（仅有均价+套数的行） */
  weightedAvgPriceBuilding: number | null;
  latestPublishDate: string;
  earliestPublishDate: string;
  districtStats: ZhPriceFilingDistrictStat[];
  recent: ZhPriceFilingRow[];
}

const DISTRICT_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "香洲区", re: /香洲/ },
  { name: "金湾区", re: /金湾/ },
  { name: "斗门区", re: /斗门/ },
  { name: "高新区", re: /高新|唐家|前岛|科技/ },
  { name: "横琴", re: /横琴/ },
  { name: "保税区", re: /保税/ }
];

export function inferZhFilingDistrict(address: string, title = ""): string {
  const blob = `${address} ${title}`;
  for (const p of DISTRICT_PATTERNS) {
    if (p.re.test(blob)) return p.name;
  }
  return "其他";
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 100) / 100;
}

function mapRow(row: Record<string, string>): ZhPriceFilingRow {
  const address = String(row.address ?? "").trim();
  const listTitle = String(row.list_title ?? "").trim();
  const districtCol = String(row.district ?? "").trim();
  return {
    postId: String(row.post_id ?? "").trim(),
    publishDate: String(row.publish_date ?? "").trim(),
    updatedDate: String(row.updated_date ?? "").trim(),
    projectName: String(row.project_name ?? "").trim(),
    address,
    district: districtCol || inferZhFilingDistrict(address, listTitle),
    units: n(row.units),
    areaSqm: n(row.area_sqm),
    avgPriceBuilding: n(row.avg_price_building),
    avgPriceInner: n(row.avg_price_inner),
    listTitle,
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

export function loadZhPriceFilingFromCSV(text: string): ZhPriceFilingRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r) => r.postId && (r.units > 0 || r.avgPriceBuilding > 0))
    .sort((a, b) => {
      const d = (b.publishDate || "").localeCompare(a.publishDate || "");
      if (d !== 0) return d;
      return b.postId.localeCompare(a.postId);
    });
}

let rows: ZhPriceFilingRow[] = loadZhPriceFilingFromCSV(String(rawCsv ?? ""));

export function getZhPriceFilingRows(): ZhPriceFilingRow[] {
  return [...rows];
}

function buildDistrictStats(list: ZhPriceFilingRow[]): ZhPriceFilingDistrictStat[] {
  const map = new Map<string, ZhPriceFilingRow[]>();
  for (const r of list) {
    const key = r.district || "其他";
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  const out: ZhPriceFilingDistrictStat[] = [];
  for (const [district, items] of map) {
    out.push({
      district,
      filingCount: items.length,
      units: items.reduce((s, r) => s + (r.units || 0), 0),
      medianAvgPriceBuilding: median(items.map((r) => r.avgPriceBuilding).filter((x) => x > 0))
    });
  }
  out.sort((a, b) => b.units - a.units || b.filingCount - a.filingCount);
  return out;
}

export function getZhPriceFilingSummary(limit = 8): ZhPriceFilingSummary | null {
  if (!rows.length) return null;
  const priced = rows.map((r) => r.avgPriceBuilding).filter((x) => x > 0);
  let wSum = 0;
  let uSum = 0;
  for (const r of rows) {
    if (r.avgPriceBuilding > 0 && r.units > 0) {
      wSum += r.avgPriceBuilding * r.units;
      uSum += r.units;
    }
  }
  const dates = rows.map((r) => r.publishDate).filter(Boolean).sort();
  return {
    filingCount: rows.length,
    totalUnits: rows.reduce((s, r) => s + (r.units || 0), 0),
    medianAvgPriceBuilding: median(priced),
    weightedAvgPriceBuilding: uSum > 0 ? Math.round((wSum / uSum) * 100) / 100 : null,
    latestPublishDate: dates[dates.length - 1] ?? rows[0]?.publishDate ?? "",
    earliestPublishDate: dates[0] ?? "",
    districtStats: buildDistrictStats(rows),
    recent: rows.slice(0, Math.max(1, limit))
  };
}

export function __setZhPriceFilingForTest(next: ZhPriceFilingRow[]): void {
  rows = [...next].sort((a, b) => {
    const d = (b.publishDate || "").localeCompare(a.publishDate || "");
    if (d !== 0) return d;
    return b.postId.localeCompare(a.postId);
  });
}
