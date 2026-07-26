/**
 * 房源标签解析（对照贝壳详情 pill：近地铁/精装/朝南…）
 * 优先 listing.tagsJson；否则回退 listing_tags.csv 行。
 */

import { getListingTags } from "./store";

export function parseTagsJson(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* 逗号分隔兜底 */
    }
    return s
      .split(/[,，|;/]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export function getListingTagLabels(listingId: number, tagsJson?: unknown): string[] {
  const fromJson = parseTagsJson(tagsJson);
  if (fromJson.length > 0) return uniquePreserve(fromJson);
  const fromRows = getListingTags()
    .filter((t) => t.listingId === listingId)
    .map((t) => t.tag)
    .filter(Boolean);
  return uniquePreserve(fromRows);
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
