/**
 * 国家统计局 70 城价格指数 —— 加载 + 查询
 *
 * 数据格式（与 `realty_app/scripts/crawl_stats_70.py` 输出一致）：
 *   date,city,fixed_base,new_idx,second_idx
 *   2006/1/1,三亚,同比,103.2,100
 *   2006/1/1,三亚,环比,101.3,100
 *
 * 主要接口：
 *   loadStats70FromCSV(text)        解析 CSV 文本
 *   getLatestIndexForCity(name)     取某城市最新一行（含 同比 / 环比）
 *   getAllCities()                  返回所有出现过的城市
 *   getRanking(base, kind)          返回所有城市按 同比 / 环比 排序（降序）
 *   getRankingByYoY(kind)           旧名，等价于 getRanking("同比", kind)
 *
 * 数据与 business 快照（`setSnapshot`）**完全独立**。App 启动时单独调用
 * `loadStats70FromCSV` 注入；不依赖真实房源数据。
 */

import type { LocalStats70Row } from "./types";
import { setStats70, getStats70, getStats70ByCity } from "./store";
import { parseCSV, rowsToObjects } from "./csv";

function dateSortKey(value: string): number {
  const [year, month, day] = value.split(/[\/-]/).map(Number);
  if (![year, month, day].every(Number.isFinite)) return 0;
  return year * 10000 + month * 100 + day;
}

/**
 * 接受与 `crawl_stats_70.py` 完全相同的窄表 CSV 文本，解析为内部行数组。
 * 同时写入全局 store 缓存（无需重复 import）。
 */
export function loadStats70FromCSV(text: string): LocalStats70Row[] {
  const objects = rowsToObjects<Record<string, string>>(parseCSV(text));
  const rows: LocalStats70Row[] = [];

  for (const r of objects) {
    const fixedBase = String(r.fixed_base ?? "").trim();
    if (fixedBase !== "同比" && fixedBase !== "环比") continue;
    rows.push({
      date: String(r.date ?? "").trim(),
      city: String(r.city ?? "").trim(),
      fixed_base: fixedBase,
      new_idx: parseIdx(r.new_idx),
      second_idx: parseIdx(r.second_idx)
    });
  }

  // 月份允许 YYYY/M/D，不能直接按字符串排（10 月会被排到 2 月前面）。
  rows.sort((a, b) => {
    const dateDiff = dateSortKey(a.date) - dateSortKey(b.date);
    if (dateDiff !== 0) return dateDiff;
    if (a.city !== b.city) return a.city < b.city ? -1 : 1;
    return 0;
  });

  setStats70(rows);
  return rows;
}

function parseIdx(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

/** 获取所有出现过的城市名（去重，按字母序）。 */
export function getAllCities(): string[] {
  const set = new Set<string>();
  for (const r of getStats70()) set.add(r.city);
  return [...set].sort();
}

/** 仅返回最近的月份字符串，例如 "2026/5/1"。 */
export function getLatestMonth(): string | null {
  const rows = getStats70();
  if (rows.length === 0) return null;
  return rows[rows.length - 1].date;
}

/**
 * 给一个城市名，返回"最新一个月"的两类指数。
 * 返回 null 表示该城市不存在。
 */
export interface LatestIndexForCity {
  city: string;
  date: string;
  newYoY: number | null; // 新建 同比
  newMoM: number | null; // 新建 环比
  secondYoY: number | null; // 二手 同比
  secondMoM: number | null; // 二手 环比
}

export function getLatestIndexForCity(cityName: string): LatestIndexForCity | null {
  const rows = getStats70ByCity(cityName);
  if (rows.length === 0) return null;
  // 找到最大 date
  const latestDate = rows[rows.length - 1].date;
  const latest = rows.filter((r) => r.date === latestDate);
  const find = (base: "同比" | "环比") => latest.find((r) => r.fixed_base === base);

  const newYoYRow = find("同比");
  const newMoMRow = find("环比");
  return {
    city: cityName,
    date: latestDate,
    newYoY: newYoYRow?.new_idx ?? null,
    newMoM: newMoMRow?.new_idx ?? null,
    secondYoY: newYoYRow?.second_idx ?? null,
    secondMoM: newMoMRow?.second_idx ?? null
  };
}

/**
 * 把"城市名 → 最新指数"封装成 map，方便 dashboard 一次查多个城市。
 */
export function getLatestIndexMapForCities(cityNames: string[]): Map<string, LatestIndexForCity> {
  const out = new Map<string, LatestIndexForCity>();
  for (const c of cityNames) {
    const v = getLatestIndexForCity(c);
    if (v) out.set(c, v);
  }
  return out;
}

/**
 * 取某城市最近 N 个月的指数时间序列。
 * base: "同比" | "环比" —— 选择参与排序的指数维度
 * kind: "new" | "second" —— 新建 / 二手
 *
 * 列表按 date 升序。空数组表示没有数据。
 * 返回字段沿用 `yoy` 名称（历史接口），尽管 base=环比 时它表示的是环比值。
 */
export function getCityTrend(
  cityName: string,
  months: number = 12,
  kind: "new" | "second" = "new",
  base: "同比" | "环比" = "同比"
): { date: string; yoy: number | null }[] {
  const rows = getStats70ByCity(cityName).filter((r) => r.fixed_base === base);
  const tail = rows.slice(-months);
  return tail.map((r) => ({
    date: r.date,
    yoy: kind === "new" ? r.new_idx : r.second_idx
  }));
}

/**
 * 全国 70 城排行：把所有城市按"最新月的 指数"降序排序。
 * base: "同比" | "环比" —— 选择参与排序的指数维度
 * kind: "new" | "second" —— 新建 / 二手
 *
 * 返回的列表已按 value 降序（null 排到末尾）。调用方如果想要升序，
 * 自行 `[...list].reverse()` 即可。
 */
export function getRanking(
  base: "同比" | "环比" = "同比",
  kind: "new" | "second" = "new"
): { city: string; date: string; value: number | null }[] {
  const all = getAllCities();
  const list: { city: string; date: string; value: number | null }[] = [];
  for (const c of all) {
    const li = getLatestIndexForCity(c);
    if (!li) continue;
    let v: number | null;
    if (base === "同比") {
      v = kind === "new" ? li.newYoY : li.secondYoY;
    } else {
      v = kind === "new" ? li.newMoM : li.secondMoM;
    }
    list.push({
      city: c,
      date: li.date,
      value: v
    });
  }
  // null 排到末尾，其它按降序
  list.sort((a, b) => {
    if (a.value == null && b.value == null) return 0;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return b.value - a.value;
  });
  return list;
}

/**
 * 向后兼容：等价于 `getRanking("同比", kind)`，保留旧调用方不报错。
 */
export function getRankingByYoY(kind: "new" | "second" = "new"): { city: string; date: string; value: number | null }[] {
  return getRanking("同比", kind);
}
