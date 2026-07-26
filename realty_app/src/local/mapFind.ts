/**
 * 地图找房筛选（对照贝壳/链家：地图上筛总价/户型 → 点小区看盘列表 → 进详情）
 */

export type MapPriceBand = "all" | "lt200" | "200_400" | "400_600" | "gte600";
export type MapBedroomBand = "all" | "1" | "2" | "3" | "4plus";

export type MapFindListing = {
  listingId: number;
  communityId: number;
  title: string;
  totalPrice10k: number | null;
  unitPrice: number | null;
  areaSqm: number | null;
  bedrooms: number | null;
  bathrooms?: number | null;
  orientation?: string | null;
  districtName?: string | null;
};

export type MapFindFilters = {
  priceBand?: MapPriceBand;
  bedroomBand?: MapBedroomBand;
  communityId?: number | null;
};

export const MAP_PRICE_BANDS: { key: MapPriceBand; label: string }[] = [
  { key: "all", label: "总价不限" },
  { key: "lt200", label: "<200万" },
  { key: "200_400", label: "200-400万" },
  { key: "400_600", label: "400-600万" },
  { key: "gte600", label: "≥600万" }
];

export const MAP_BEDROOM_BANDS: { key: MapBedroomBand; label: string }[] = [
  { key: "all", label: "户型不限" },
  { key: "1", label: "1室" },
  { key: "2", label: "2室" },
  { key: "3", label: "3室" },
  { key: "4plus", label: "4室+" }
];

export function matchPriceBand(totalPrice10k: number | null | undefined, band: MapPriceBand): boolean {
  if (band === "all") return true;
  if (totalPrice10k == null || !Number.isFinite(totalPrice10k)) return false;
  if (band === "lt200") return totalPrice10k < 200;
  if (band === "200_400") return totalPrice10k >= 200 && totalPrice10k < 400;
  if (band === "400_600") return totalPrice10k >= 400 && totalPrice10k < 600;
  return totalPrice10k >= 600;
}

export function matchBedroomBand(bedrooms: number | null | undefined, band: MapBedroomBand): boolean {
  if (band === "all") return true;
  if (bedrooms == null || !Number.isFinite(bedrooms)) return false;
  if (band === "1") return bedrooms === 1;
  if (band === "2") return bedrooms === 2;
  if (band === "3") return bedrooms === 3;
  return bedrooms >= 4;
}

export function filterMapListings<T extends MapFindListing>(
  listings: T[],
  filters: MapFindFilters = {}
): T[] {
  const priceBand = filters.priceBand ?? "all";
  const bedroomBand = filters.bedroomBand ?? "all";
  const communityId = filters.communityId ?? null;
  return listings.filter((l) => {
    if (communityId != null && l.communityId !== communityId) return false;
    if (!matchPriceBand(l.totalPrice10k, priceBand)) return false;
    if (!matchBedroomBand(l.bedrooms, bedroomBand)) return false;
    return true;
  });
}

/** 按挂牌总价升序，缺价沉底；限制条数给地图底栏 */
export function sortMapListingsForSheet<T extends MapFindListing>(listings: T[], limit = 40): T[] {
  const sorted = [...listings].sort((a, b) => {
    const pa = a.totalPrice10k;
    const pb = b.totalPrice10k;
    if (pa == null && pb == null) return a.listingId - b.listingId;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });
  return sorted.slice(0, limit);
}

/** 对照贝壳地图底栏行：总价 · 单价 · 室卫 · 面积 · 朝向 */
export function formatListingCardLine(l: MapFindListing): string {
  const price = l.totalPrice10k != null ? `${l.totalPrice10k}万` : "价格待定";
  const unit =
    l.unitPrice != null && Number.isFinite(l.unitPrice)
      ? `${Math.round(l.unitPrice).toLocaleString()}元/㎡`
      : null;
  const layout =
    l.bedrooms != null
      ? l.bathrooms != null
        ? `${l.bedrooms}室${l.bathrooms}卫`
        : `${l.bedrooms}室`
      : "户型—";
  const area = l.areaSqm != null ? `${Math.round(l.areaSqm)}㎡` : "面积—";
  const orient = l.orientation?.trim() ? l.orientation.trim() : null;
  return [price, unit, layout, area, orient].filter(Boolean).join(" · ");
}

/** 距点击点最近的小区（米级近似：1°≈111km） */
export function nearestCommunityId(
  lat: number,
  lng: number,
  communities: { communityId: number; lat: number; lng: number }[],
  maxKm = 1.2
): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || communities.length === 0) return null;
  let bestId: number | null = null;
  let bestD = Infinity;
  for (const c of communities) {
    const dLat = (c.lat - lat) * 111;
    const dLng = (c.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d < bestD) {
      bestD = d;
      bestId = c.communityId;
    }
  }
  return bestD <= maxKm ? bestId : null;
}
