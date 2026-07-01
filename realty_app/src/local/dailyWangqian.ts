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
    rows.push({
      date: String(r.date ?? "").trim(),
      city: String(r.city ?? "").trim(),
      category,
      district: String(r.district ?? "").trim(),
      units,
      area_sqm: area,
      granularity: String(r.granularity ?? "city").trim() as "city" | "district",
      source_url: String(r.source_url ?? "").trim()
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

function parseIntField(s: string | undefined): number {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseFloatField(s: string | undefined): number {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export { hasDailyWangqian, getDailyWangqian };

export interface CityDailySnapshot {
  city: string;
  date: string;
  newUnits: number | null;
  newArea: number | null;
  secondUnits: number | null;
  secondArea: number | null;
}

/** 某城市最近一个交易日的全市汇总（granularity=city, district=全市）。 */
export function getLatestCityDaily(cityName: string): CityDailySnapshot | null {
  const target = (cityName ?? "").replace(/市$/, "");
  const rows = getDailyWangqianByCity(target).filter(
    (r) => r.granularity === "city" && r.district === "全市"
  );
  if (rows.length === 0) return null;

  const latestDate = rows[rows.length - 1].date;
  const dayRows = rows.filter((r) => r.date === latestDate);
  const find = (cat: "新房" | "二手") => dayRows.find((r) => r.category === cat);

  const nw = find("新房");
  const sec = find("二手");
  return {
    city: target,
    date: latestDate,
    newUnits: nw?.units ?? null,
    newArea: nw?.area_sqm ?? null,
    secondUnits: sec?.units ?? null,
    secondArea: sec?.area_sqm ?? null
  };
}

/** 最近 N 个交易日的全市新房/二手套数序列（按 date 升序）。 */
export function getCityDailyTrend(
  cityName: string,
  days: number = 14,
  category: "新房" | "二手" = "新房"
): { date: string; units: number; area_sqm: number }[] {
  const target = (cityName ?? "").replace(/市$/, "");
  const rows = getDailyWangqianByCity(target).filter(
    (r) =>
      r.granularity === "city" &&
      r.district === "全市" &&
      r.category === category
  );
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
