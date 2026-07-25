/**
 * v0.92.0 派生：地铁步行可达性概览。
 *
 * 输入：snapshot.metroWalks（LocalMetroWalk[]），每行表示 1 个小区
 * 到最近的地铁站的步行分钟（已在 store 里）。
 *
 * 派生指标：
 *   - 每个城市的"步行 ≤ 5 分钟小区占比"和"步行 ≤ 10 分钟小区占比"
 *   - 全市 / 全国步行可达排名 Top N（按 walkMinutes 升序）
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getMetroWalks, getMetroWalksByCity } from "./store";
import type { LocalMetroWalk } from "./types";

export interface MetroWalkAccessibility {
  cityId: number;
  totalCommunities: number;
  /** walkMinutes <= 5min 的小区数（就近地铁，小区以地铁周边为卖点） */
  within5Min: number;
  /** walkMinutes <= 10min 的小区数（步行友好的上限） */
  within10Min: number;
  /** within5Min / totalCommunities，无数据时返回 null */
  pct5Min: number | null;
  /** within10Min / totalCommunities */
  pct10Min: number | null;
}

export function summarizeMetroWalkAccessibility(): MetroWalkAccessibility[] {
  const all = getMetroWalks();
  const byCity = new Map<number, LocalMetroWalk[]>();
  for (const m of all) {
    let arr = byCity.get(m.cityId);
    if (!arr) {
      arr = [];
      byCity.set(m.cityId, arr);
    }
    arr.push(m);
  }
  const out: MetroWalkAccessibility[] = [];
  for (const [cityId, arr] of byCity.entries()) {
    const total = arr.length;
    const w5 = arr.filter((m) => m.walkMinutes <= 5).length;
    const w10 = arr.filter((m) => m.walkMinutes <= 10).length;
    out.push({
      cityId,
      totalCommunities: total,
      within5Min: w5,
      within10Min: w10,
      pct5Min: total > 0 ? w5 / total : null,
      pct10Min: total > 0 ? w10 / total : null
    });
  }
  // 按 5 分钟占比降序，让"地铁最友好"的城市浮到顶
  out.sort((a, b) => (b.pct5Min ?? 0) - (a.pct5Min ?? 0));
  return out;
}

export interface MetroWalkRankingItem extends LocalMetroWalk {
  /** rank 在所有 metroWalks 中（升序，1=最快） */
  rank: number;
}

export function getMetroWalkRankingTopN(limit: number = 5): MetroWalkRankingItem[] {
  const sorted = [...getMetroWalks()].sort((a, b) => a.walkMinutes - b.walkMinutes);
  return sorted.slice(0, limit).map((m, i) => ({ ...m, rank: i + 1 }));
}

export function getMetroWalkRankingByCityTopN(
  cityId: number,
  limit: number = 5
): MetroWalkRankingItem[] {
  const sorted = [...getMetroWalksByCity(cityId)].sort(
    (a, b) => a.walkMinutes - b.walkMinutes
  );
  return sorted.slice(0, limit).map((m, i) => ({ ...m, rank: i + 1 }));
}
