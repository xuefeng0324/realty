import type { ListingSourceKind } from "./types";

export function normalizeListingSourceKind(
  value: unknown,
  source: string | null = null
): ListingSourceKind {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "REAL" || raw === "DERIVED" || raw === "ESTIMATED") return raw;

  const label = source ?? "";
  if (/派生|样本|住建局公开成交/.test(label)) return "DERIVED";
  if (/链家|安居客/.test(label)) return "REAL";
  return "UNKNOWN";
}

export function listingSourceKindLabel(kind: ListingSourceKind): string {
  if (kind === "REAL") return "真实挂牌";
  if (kind === "DERIVED") return "派生样本";
  if (kind === "ESTIMATED") return "估算数据";
  return "来源未分级";
}
