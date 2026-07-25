/**
 * v0.96.0 派生：城市级标签预聚合横评。
 *
 * 输入：snapshot.listingTagSummaries（LocalListingTagSummary[]，52 行 / 3 城市），
 * 每行表示 (cityId, cityName, tag, count, share)。
 *
 * 派生指标：
 *   - summarizeListingTagsByCity: 每市 Top 标签 + 总标签数 / 总计数
 *   - getTagPenetrationCompare: 跨城同一标签对比（"名校区" → 广 11.23% / 深 16.41% / 珠 2.45%）
 *   - getCityTagSignature: 找出某市"显著高"的标签（平均 share × 1.5 以上的 tag）
 *
 * 完全派生，零外部依赖 / 零抓虫。
 */

import { getListingTagSummaries } from "./store";
import type { LocalListingTagSummary } from "./types";

export interface CityTagSummary {
  cityId: number;
  cityName: string;
  totalTags: number;
  /** 该市所有 tag 的 count 之和（用于占比归一） */
  totalCount: number;
  topTags: { tag: string; share: number; count: number }[];
}

/**
 * 每市 Top 标签 + 统计。topTags 默认 8 条。
 */
export function summarizeListingTagsByCity(
  topN: number = 8
): CityTagSummary[] {
  const all = getListingTagSummaries();
  if (all.length === 0) return [];
  const grouped = new Map<number, LocalListingTagSummary[]>();
  for (const t of all) {
    let arr = grouped.get(t.cityId);
    if (!arr) {
      arr = [];
      grouped.set(t.cityId, arr);
    }
    arr.push(t);
  }
  const out: CityTagSummary[] = [];
  for (const arr of grouped.values()) {
    const sorted = [...arr].sort((a, b) => b.share - a.share);
    let totalCount = 0;
    for (const r of arr) totalCount += r.count;
    out.push({
      cityId: arr[0]!.cityId,
      cityName: arr[0]!.cityName,
      totalTags: arr.length,
      totalCount,
      topTags: sorted.slice(0, topN).map((t) => ({
        tag: t.tag,
        share: t.share,
        count: t.count
      }))
    });
  }
  out.sort((a, b) => a.cityId - b.cityId);
  return out;
}

/**
 * 跨城同一标签对比：返回按出现城市数倒序 + share 总和排序的"标签 → 各城市 share"对照。
 * 输出形如 [{ tag, byCity: { cityId→ share }, presentIn }, ...]。
 */
export interface TagPenetration {
  tag: string;
  byCity: Record<number, { cityName: string; share: number; count: number }>;
  /** 出现在哪些城市 */
  presentIn: number[];
  /** presentIn 中 share 的平均值 (0–1) */
  avgShare: number;
}

export function getTagPenetrationCompare(): TagPenetration[] {
  const all = getListingTagSummaries();
  if (all.length === 0) return [];
  const grouped = new Map<string, LocalListingTagSummary[]>();
  for (const t of all) {
    let arr = grouped.get(t.tag);
    if (!arr) {
      arr = [];
      grouped.set(t.tag, arr);
    }
    arr.push(t);
  }
  const out: TagPenetration[] = [];
  for (const arr of grouped.values()) {
    const byCity: TagPenetration["byCity"] = {};
    let shareSum = 0;
    const presentIn: number[] = [];
    for (const t of arr) {
      byCity[t.cityId] = {
        cityName: t.cityName,
        share: t.share,
        count: t.count
      };
      shareSum += t.share;
      presentIn.push(t.cityId);
    }
    out.push({
      tag: arr[0]!.tag,
      byCity,
      presentIn,
      avgShare: arr.length > 0 ? shareSum / arr.length : 0
    });
  }
  // 排序：出现城市数越多越靠前（横向可比越大），次之 share 总和越大越靠前
  out.sort((a, b) => {
    if (b.presentIn.length !== a.presentIn.length) {
      return b.presentIn.length - a.presentIn.length;
    }
    return b.avgShare - a.avgShare;
  });
  return out;
}

/**
 * 一市 vs 全样本平均的"特色标签"：该市 share >= 全样本均值 × 1.5。
 * 用于回答"深圳哪些标签特别高（vs 其他城市）"。
 */
export interface TagSignatureEntry {
  tag: string;
  cityId: number;
  cityName: string;
  share: number;
  /** 全样本（其他城）平均 share */
  otherAvg: number;
}

export function getCityTagSignature(
  cityId: number,
  boost: number = 1.5
): TagSignatureEntry[] {
  const all = getListingTagSummaries();
  if (all.length === 0) return [];
  const tagToCityShares = new Map<string, Map<number, number>>();
  for (const t of all) {
    let m = tagToCityShares.get(t.tag);
    if (!m) {
      m = new Map();
      tagToCityShares.set(t.tag, m);
    }
    m.set(t.cityId, t.share);
  }
  const out: TagSignatureEntry[] = [];
  for (const [tag, m] of tagToCityShares.entries()) {
    const myShare = m.get(cityId);
    if (myShare == null) continue;
    const others: number[] = [];
    for (const [cid, share] of m.entries()) {
      if (cid !== cityId) others.push(share);
    }
    if (others.length === 0) continue;
    const otherAvg =
      others.reduce((s, x) => s + x, 0) / others.length;
    if (myShare >= otherAvg * boost) {
      out.push({
        tag,
        cityId,
        cityName: all.find((x) => x.cityId === cityId)?.cityName ?? "",
        share: myShare,
        otherAvg
      });
    }
  }
  out.sort((a, b) => b.share - a.share);
  return out;
}
