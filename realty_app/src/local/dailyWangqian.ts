/**
 * 深圳 / 广州 政府网签日更 —— 加载 + 查询
 *
 * 数据格式（与 `scripts/crawl_daily_wangqian.py` 输出一致）：
 *   date,city,category,district,units,area_sqm,granularity,source_url
 *
 * 与 70 城指数、挂牌 listings 独立；启动时由 App.vue 注入。
 */

import type { LocalDailyWangqianRow } from "./types";
import { parseCSV, rowsToObjects } from "./csv";
import {
  getDailyWangqian,
  getDailyWangqianByCity,
  hasDailyWangqian,
  setDailyWangqian
} from "./store";

export function loadDailyWangqianFromCSV(text: string): LocalDailyWangqianRow[] {
  const objects = rowsToObjects<Record<string, string>>(parseCSV(text));
  const rows: LocalDailyWangqianRow[] = [];

  for (const r of objects) {
    const category = String(r.category ?? "").trim();
    if (category !== "新房" && category !== "二手") continue;
    const units = parseIntField(r.units);
    const area = parseFloatField(r.area_sqm);
    const granularity = String(r.granularity ?? "city").trim() as LocalDailyWangqianRow["granularity"];
    const sourceUrl = String(r.source_url ?? "").trim();
    const scope = normalizeScope(String(r.scope ?? "").trim(), category, granularity, sourceUrl);
    rows.push({
      date: String(r.date ?? "").trim(),
      city: String(r.city ?? "").trim(),
      category,
      scope,
      district: String(r.district ?? "").trim(),
      units,
      area_sqm: area,
      granularity,
      source_url: sourceUrl
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.city !== b.city) return a.city < b.city ? -1 : 1;
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return 0;
  });

  setDailyWangqian(rows);
  return rows;
}

/** 旧 CSV 无 scope 列时的兼容推断（与爬虫 _infer_scope 对齐）。 */
function normalizeScope(
  raw: string,
  category: string,
  granularity: LocalDailyWangqianRow["granularity"],
  sourceUrl: string
): "住宅" | "全部" {
  if (raw === "住宅" || raw === "全部") return raw;
  if (sourceUrl.includes("housePriceTrendInfo")) return "住宅";
  const isDistrictLike = granularity === "district" || granularity === "month_district";
  if (category === "二手" && isDistrictLike) return "全部";
  return "住宅";
}

function parseIntField(s: string | undefined): number {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseFloatField(s: string | undefined): number {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export { hasDailyWangqian, getDailyWangqian };

export type WangqianScope = "住宅" | "全部";

/** 全市（granularity=city, district=全市）某口径的日序列，按 date 升序、按 (date,category) 去重。 */
function cityScopeRows(cityName: string, scope: WangqianScope): LocalDailyWangqianRow[] {
  const target = (cityName ?? "").replace(/市$/, "");
  const raw = getDailyWangqianByCity(target).filter(
    (r) => r.granularity === "city" && r.district === "全市" && r.scope === scope
  );
  const byKey = new Map<string, LocalDailyWangqianRow>();
  for (const r of raw) byKey.set(`${r.date}|${r.category}`, r);
  const out = [...byKey.values()];
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export interface CityDailySnapshot {
  city: string;
  date: string;
  /** 新房（商品住房，走势页口径） */
  newUnits: number | null;
  newArea: number | null;
  /** 二手 · 住宅（走势页 getFjzsInfoData） */
  secondResidentialUnits: number | null;
  secondResidentialArea: number | null;
  /** 二手 · 全部（分区公示 getEsfCjxxGsDataNew，含非住宅；仅最新日） */
  secondAllUnits: number | null;
  secondAllArea: number | null;
}

/** 某城市最近一个交易日的全市汇总（住宅口径为主，附二手全部口径）。 */
export function getLatestCityDaily(cityName: string): CityDailySnapshot | null {
  const target = (cityName ?? "").replace(/市$/, "");
  const residential = cityScopeRows(target, "住宅");
  if (residential.length === 0) return null;

  const latestDate = residential[residential.length - 1].date;
  const dayRows = residential.filter((r) => r.date === latestDate);
  const nw = dayRows.find((r) => r.category === "新房");
  const secRes = dayRows.find((r) => r.category === "二手");

  const allRows = cityScopeRows(target, "全部").filter((r) => r.category === "二手");
  const secAll =
    allRows.find((r) => r.date === latestDate) ?? allRows[allRows.length - 1];

  return {
    city: target,
    date: latestDate,
    newUnits: nw?.units ?? null,
    newArea: nw?.area_sqm ?? null,
    secondResidentialUnits: secRes?.units ?? null,
    secondResidentialArea: secRes?.area_sqm ?? null,
    secondAllUnits: secAll?.units ?? null,
    secondAllArea: secAll?.area_sqm ?? null
  };
}

/** 最近 N 个交易日的全市套数序列（默认住宅口径，仅住宅有历史）。 */
export function getCityDailyTrend(
  cityName: string,
  days: number = 14,
  category: "新房" | "二手" = "新房",
  scope: WangqianScope = "住宅"
): { date: string; units: number; area_sqm: number }[] {
  const rows = cityScopeRows(cityName, scope).filter((r) => r.category === category);
  return rows.slice(-days).map((r) => ({
    date: r.date,
    units: r.units,
    area_sqm: r.area_sqm
  }));
}

export function getSupportedWangqianCities(): string[] {
  const set = new Set<string>();
  for (const r of getDailyWangqian()) {
    if (r.granularity === "city" && r.district === "全市") {
      set.add(r.city);
    }
  }
  return [...set].sort();
}

/**
 * 某城市政府网签覆盖的所有行政区名（去重，去「区」后缀）。
 * 深圳/广州由此可拿到全部真实行政区，用于校正挂牌数据的分区覆盖率。
 */
export function getWangqianDistrictNames(cityName: string): string[] {
  const target = (cityName ?? "").replace(/市$/, "");
  const set = new Set<string>();
  for (const r of getDailyWangqianByCity(target)) {
    if (r.granularity !== "district" && r.granularity !== "month_district") continue;
    const d = (r.district ?? "").replace(/区$/, "").trim();
    if (d && d !== "全市") set.add(d);
  }
  return [...set].sort();
}

export interface DistrictDailyRow {
  district: string;
  /** 新房（住宅口径，与走势页一致） */
  newUnits: number;
  newArea: number;
  /** 二手（全部口径，含非住宅；仅深圳分区公示提供） */
  secondUnits: number | null;
  secondArea: number | null;
}

export interface DistrictBreakdown {
  date: string;
  rows: DistrictDailyRow[];
  /** 全市新房（住宅，走势页） */
  cityNewUnits: number | null;
  /** 全市二手 · 住宅（走势页 188 类） */
  citySecondResidentialUnits: number | null;
  /** 全市二手 · 全部（分区合计 239 类） */
  citySecondAllUnits: number | null;
  /** 分区合计 */
  districtNewSum: number;
  districtSecondSum: number;
  /** 二手住宅与全部的差（≈ 非住宅二手） */
  secondNonResidentialUnits: number | null;
}

/**
 * 最近交易日各行政区网签。
 * 新房分区取住宅口径（getYsfCjxxGsDataNew，合计=走势新房）；
 * 二手分区取全部口径（getEsfCjxxGsDataNew，合计=全部二手）。
 */
export function getLatestDistrictBreakdown(cityName: string): DistrictBreakdown | null {
  const snap = getLatestCityDaily(cityName);
  if (!snap) return null;

  const target = (cityName ?? "").replace(/市$/, "");
  const districtRows = getDailyWangqianByCity(target).filter(
    (r) => r.granularity === "district" && r.date === snap.date
  );
  if (districtRows.length === 0) {
    return {
      date: snap.date,
      rows: [],
      cityNewUnits: snap.newUnits,
      citySecondResidentialUnits: snap.secondResidentialUnits,
      citySecondAllUnits: snap.secondAllUnits,
      districtNewSum: 0,
      districtSecondSum: 0,
      secondNonResidentialUnits: diffOrNull(snap.secondAllUnits, snap.secondResidentialUnits)
    };
  }

  const byDist = new Map<string, DistrictDailyRow>();
  for (const r of districtRows) {
    let row = byDist.get(r.district);
    if (!row) {
      row = {
        district: r.district,
        newUnits: 0,
        newArea: 0,
        secondUnits: null,
        secondArea: null
      };
      byDist.set(r.district, row);
    }
    if (r.category === "新房") {
      row.newUnits = r.units;
      row.newArea = r.area_sqm;
    } else {
      row.secondUnits = r.units;
      row.secondArea = r.area_sqm;
    }
  }

  const rows = [...byDist.values()].sort(
    (a, b) =>
      b.newUnits + (b.secondUnits ?? 0) - (a.newUnits + (a.secondUnits ?? 0))
  );
  const districtNewSum = rows.reduce((s, r) => s + r.newUnits, 0);
  const districtSecondSum = rows.reduce((s, r) => s + (r.secondUnits ?? 0), 0);
  return {
    date: snap.date,
    rows,
    cityNewUnits: snap.newUnits,
    citySecondResidentialUnits: snap.secondResidentialUnits,
    citySecondAllUnits: snap.secondAllUnits,
    districtNewSum,
    districtSecondSum,
    secondNonResidentialUnits: diffOrNull(snap.secondAllUnits, snap.secondResidentialUnits)
  };
}

function diffOrNull(all: number | null, residential: number | null): number | null {
  if (all == null || residential == null) return null;
  return all - residential;
}

export interface MonthlyDeal {
  /** 数据月，如 2026-06 */
  month: string;
  newUnits: number | null;
  newArea: number | null;
  secondUnits: number | null;
  secondArea: number | null;
  districts: {
    district: string;
    newUnits: number;
    newArea: number;
    secondUnits: number;
    secondArea: number;
  }[];
}

/** 最近一个完整月的分区成交（granularity=month / month_district，仅深圳）。 */
export function getLatestMonthlyDeal(cityName: string): MonthlyDeal | null {
  const target = (cityName ?? "").replace(/市$/, "");
  const rows = getDailyWangqianByCity(target).filter(
    (r) => r.granularity === "month" || r.granularity === "month_district"
  );
  if (rows.length === 0) return null;

  const latest = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const monthRows = rows.filter((r) => r.date === latest);
  const cityNew = monthRows.find((r) => r.granularity === "month" && r.category === "新房");
  const citySecond = monthRows.find((r) => r.granularity === "month" && r.category === "二手");

  const byDist = new Map<string, { district: string; newUnits: number; newArea: number; secondUnits: number; secondArea: number }>();
  for (const r of monthRows) {
    if (r.granularity !== "month_district") continue;
    let d = byDist.get(r.district);
    if (!d) {
      d = { district: r.district, newUnits: 0, newArea: 0, secondUnits: 0, secondArea: 0 };
      byDist.set(r.district, d);
    }
    if (r.category === "新房") {
      d.newUnits = r.units;
      d.newArea = r.area_sqm;
    } else {
      d.secondUnits = r.units;
      d.secondArea = r.area_sqm;
    }
  }
  const districts = [...byDist.values()].sort(
    (a, b) => b.newUnits + b.secondUnits - (a.newUnits + a.secondUnits)
  );

  return {
    month: latest.slice(0, 7),
    newUnits: cityNew?.units ?? null,
    newArea: cityNew?.area_sqm ?? null,
    secondUnits: citySecond?.units ?? null,
    secondArea: citySecond?.area_sqm ?? null,
    districts
  };
}
