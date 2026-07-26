import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/zh_bdc_registration.csv?raw";
// @ts-ignore
import rawDistrictCsv from "../../static/zh_bdc_registration_district.csv?raw";

/** 珠海不动产登记中心季度登记量（官方 PNG 表人工抄录合计行；≠日更网签、≠挂牌均价） */
export type ZhBdcMetricKind = "new_commodity" | "stock_transfer";

export interface ZhBdcRegistrationRow {
  city: string;
  year: number;
  quarter: number;
  metricKind: ZhBdcMetricKind;
  residentialUnits: number;
  residentialAreaWanSqm: number;
  commercialUnits: number;
  commercialAreaWanSqm: number;
  officeUnits: number;
  officeAreaWanSqm: number;
  otherUnits: number;
  otherAreaWanSqm: number;
  publishDate: string;
  sourceOrg: string;
  sourceUrl: string;
  imageUrl: string;
  note: string;
}

export interface ZhBdcDistrictRow {
  city: string;
  year: number;
  quarter: number;
  metricKind: ZhBdcMetricKind;
  district: string;
  residentialUnits: number;
  residentialAreaWanSqm: number;
  commercialUnits: number;
  commercialAreaWanSqm: number;
  officeUnits: number;
  officeAreaWanSqm: number;
  otherUnits: number;
  otherAreaWanSqm: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapKind(raw: string): ZhBdcMetricKind | null {
  const k = raw.trim();
  if (k === "new_commodity" || k === "stock_transfer") return k;
  return null;
}

function mapRow(row: Record<string, string>): ZhBdcRegistrationRow | null {
  const metricKind = mapKind(String(row.metric_kind ?? ""));
  if (!metricKind) return null;
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    quarter: n(row.quarter),
    metricKind,
    residentialUnits: n(row.residential_units),
    residentialAreaWanSqm: n(row.residential_area_wan_sqm),
    commercialUnits: n(row.commercial_units),
    commercialAreaWanSqm: n(row.commercial_area_wan_sqm),
    officeUnits: n(row.office_units),
    officeAreaWanSqm: n(row.office_area_wan_sqm),
    otherUnits: n(row.other_units),
    otherAreaWanSqm: n(row.other_area_wan_sqm),
    publishDate: String(row.publish_date ?? "").trim(),
    sourceOrg: String(row.source_org ?? "").trim(),
    sourceUrl: String(row.source_url ?? "").trim(),
    imageUrl: String(row.image_url ?? "").trim(),
    note: String(row.note ?? "").trim()
  };
}

function mapDistrictRow(row: Record<string, string>): ZhBdcDistrictRow | null {
  const metricKind = mapKind(String(row.metric_kind ?? ""));
  const district = String(row.district ?? "").trim();
  if (!metricKind || !district) return null;
  return {
    city: String(row.city ?? "").trim(),
    year: n(row.year),
    quarter: n(row.quarter),
    metricKind,
    district,
    residentialUnits: n(row.residential_units),
    residentialAreaWanSqm: n(row.residential_area_wan_sqm),
    commercialUnits: n(row.commercial_units),
    commercialAreaWanSqm: n(row.commercial_area_wan_sqm),
    officeUnits: n(row.office_units),
    officeAreaWanSqm: n(row.office_area_wan_sqm),
    otherUnits: n(row.other_units),
    otherAreaWanSqm: n(row.other_area_wan_sqm),
    sourceUrl: String(row.source_url ?? "").trim()
  };
}

function sortRows(list: ZhBdcRegistrationRow[]): ZhBdcRegistrationRow[] {
  return [...list].sort(
    (a, b) =>
      b.year - a.year ||
      b.quarter - a.quarter ||
      (a.metricKind === b.metricKind ? 0 : a.metricKind === "new_commodity" ? -1 : 1)
  );
}

export function loadZhBdcRegistrationFromCSV(text: string): ZhBdcRegistrationRow[] {
  return sortRows(
    rowsToObjects<Record<string, string>>(parseCSV(text))
      .map(mapRow)
      .filter((r): r is ZhBdcRegistrationRow => !!r)
      .filter((r) => r.city === "珠海" && r.year >= 2000 && r.quarter >= 1 && r.quarter <= 4)
  );
}

export function loadZhBdcDistrictFromCSV(text: string): ZhBdcDistrictRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapDistrictRow)
    .filter((r): r is ZhBdcDistrictRow => !!r)
    .filter((r) => r.city === "珠海" && r.year >= 2000 && r.quarter >= 1 && r.quarter <= 4)
    .sort(
      (a, b) =>
        b.year - a.year ||
        b.quarter - a.quarter ||
        b.residentialUnits - a.residentialUnits ||
        a.district.localeCompare(b.district, "zh")
    );
}

let rows: ZhBdcRegistrationRow[] = loadZhBdcRegistrationFromCSV(String(rawCsv ?? ""));
let districtRows: ZhBdcDistrictRow[] = loadZhBdcDistrictFromCSV(String(rawDistrictCsv ?? ""));

export function getZhBdcRegistrationRows(): ZhBdcRegistrationRow[] {
  return [...rows];
}

export function getZhBdcRowsByKind(kind: ZhBdcMetricKind): ZhBdcRegistrationRow[] {
  return rows.filter((r) => r.metricKind === kind);
}

export function getLatestZhBdcByKind(kind: ZhBdcMetricKind): ZhBdcRegistrationRow | null {
  return getZhBdcRowsByKind(kind)[0] ?? null;
}

/** 同一 metric 的相邻季度住宅套数差；缺相邻季则 null */
export function getZhBdcResidentialQoQ(kind: ZhBdcMetricKind): {
  prev: ZhBdcRegistrationRow;
  unitsDelta: number;
  areaDeltaWan: number;
} | null {
  const list = getZhBdcRowsByKind(kind);
  if (list.length < 2) return null;
  const cur = list[0]!;
  const expectYear = cur.quarter === 1 ? cur.year - 1 : cur.year;
  const expectQuarter = cur.quarter === 1 ? 4 : cur.quarter - 1;
  const prev = list.find((r) => r.year === expectYear && r.quarter === expectQuarter) ?? null;
  if (!prev) return null;
  return {
    prev,
    unitsDelta: cur.residentialUnits - prev.residentialUnits,
    areaDeltaWan: Math.round((cur.residentialAreaWanSqm - prev.residentialAreaWanSqm) * 100) / 100
  };
}

/** 与全市合计同行同期的分区明细（住宅套数降序） */
export function getZhBdcDistrictsFor(
  cityRow: ZhBdcRegistrationRow | null,
  kind?: ZhBdcMetricKind
): ZhBdcDistrictRow[] {
  if (!cityRow) return [];
  const k = kind ?? cityRow.metricKind;
  return districtRows
    .filter((r) => r.year === cityRow.year && r.quarter === cityRow.quarter && r.metricKind === k)
    .sort(
      (a, b) =>
        b.residentialUnits - a.residentialUnits || a.district.localeCompare(b.district, "zh")
    );
}

/** 分区住宅套数之和应等于全市合计（抽检用） */
export function sumZhBdcDistrictResidential(list: ZhBdcDistrictRow[]): number {
  return list.reduce((s, r) => s + r.residentialUnits, 0);
}

export function formatZhBdcPeriod(row: ZhBdcRegistrationRow): string {
  return `${row.year} 年 Q${row.quarter}`;
}

export function zhBdcMetricLabel(kind: ZhBdcMetricKind): string {
  return kind === "new_commodity" ? "新增商品房登记" : "存量房转移登记";
}

export function __setZhBdcRegistrationForTest(next: ZhBdcRegistrationRow[]): void {
  rows = sortRows(next);
}

export function __setZhBdcDistrictForTest(next: ZhBdcDistrictRow[]): void {
  districtRows = [...next];
}
