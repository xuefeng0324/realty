/**
 * 地图热力 / 挂牌均价计算（可单测）。
 *
 * 对照：贝壳/链家地图找房 = 浅色底图 + 半透明热力点 + 可读图例；
 * uni-app `<map>` circles 的 fillColor 应用 8 位 hex（含 alpha），
 * `rgb()` 在 App WebView 常失效 → 整片黑/灰糊。
 */

export type HeatCommunity = {
  lat: number;
  lng: number;
  listingCount: number;
  avgUnitPrice: number | null;
};

export type MapCircle = {
  longitude: number;
  latitude: number;
  color: string;
  fillColor: string;
  radius: number;
  strokeWidth: number;
};

export type PriceBucket = {
  label: string;
  color: string;
  min: number;
  max: number;
};

/** 热力圆描边（浅白半透明，避免黑边） */
export const HEAT_STROKE = "#ffffff66";

/** 5 档挂牌均价色（图例实心） */
export const PRICE_RAMP_SOLID = ["#22c55e", "#a3e635", "#fbbf24", "#f97316", "#dc2626"] as const;

/** 5 档挂牌均价色（地图圆半透明，约 55% 不透明） */
export const PRICE_RAMP_FILL = ["#22c55e8c", "#a3e6358c", "#fbbf248c", "#f973168c", "#dc26268c"] as const;

export function normalizeRange(value: number | null | undefined, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.max(0, Math.min(1, ((value as number) - min) / (max - min)));
}

export function heatRadius(priceRatio: number, countRatio: number): number {
  const price = Math.max(0, Math.min(1, priceRatio));
  const count = Math.max(0, Math.min(1, countRatio));
  return 200 + Math.round((0.3 * price + 0.7 * count) * 800);
}

/** 挂牌数热力：蓝→红，半透明 hex */
export function countColorRamp(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(30 + clamped * 220);
  const g = Math.round(120 - clamped * 100);
  const b = Math.round(200 - clamped * 180);
  return rgbToHexAlpha(r, g, b, 0x8c);
}

/** 挂牌均价 5 档插值 → 半透明 hex（给 map circles） */
export function priceColorRamp5(t: number): string {
  const stops = [
    { t: 0.0, color: [34, 197, 94] },
    { t: 0.25, color: [163, 230, 53] },
    { t: 0.5, color: [251, 191, 36] },
    { t: 0.75, color: [249, 115, 22] },
    { t: 1.0, color: [220, 38, 38] }
  ];
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const k = (clamped - a.t) / (b.t - a.t || 1);
      const r = Math.round(a.color[0] + k * (b.color[0] - a.color[0]));
      const g = Math.round(a.color[1] + k * (b.color[1] - a.color[1]));
      const bl = Math.round(a.color[2] + k * (b.color[2] - a.color[2]));
      return rgbToHexAlpha(r, g, bl, 0x8c);
    }
  }
  const last = stops[stops.length - 1].color;
  return rgbToHexAlpha(last[0], last[1], last[2], 0x8c);
}

/** 图例文案：30000→30k；禁止再出现整表 0k-0k */
export function formatPriceRangeK(min: number, max: number): string {
  const toK = (n: number): string => {
    if (!Number.isFinite(n) || n < 0) return "—";
    if (n === 0) return "0k";
    const k = Math.round(n / 1000);
    return `${Math.max(1, k)}k`;
  };
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return "—";
  if (min <= 0 && max <= 0) return "—";
  return `${toK(min)}-${toK(max)}`;
}

export function buildPriceBuckets(sortedOrUnsortedPrices: number[]): PriceBucket[] {
  const priced = sortedOrUnsortedPrices
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (priced.length === 0) return [];
  const at = (q: number): number => priced[Math.min(priced.length - 1, Math.floor(priced.length * q))];
  const minPrice = priced[0];
  const maxPrice = priced[priced.length - 1];
  return [
    { label: "P0-P20 最便宜", color: PRICE_RAMP_SOLID[0], min: minPrice, max: at(0.2) },
    { label: "P20-P40", color: PRICE_RAMP_SOLID[1], min: at(0.2), max: at(0.4) },
    { label: "P40-P60 中位", color: PRICE_RAMP_SOLID[2], min: at(0.4), max: at(0.6) },
    { label: "P60-P80", color: PRICE_RAMP_SOLID[3], min: at(0.6), max: at(0.8) },
    { label: "P80-P100 最贵", color: PRICE_RAMP_SOLID[4], min: at(0.8), max: maxPrice }
  ];
}

/**
 * 挂牌均价热力圆：只画有均价的社区（无价不铺灰圆，否则整图「黑乎乎」）。
 */
export function buildPriceHeatCircles(communities: HeatCommunity[]): MapCircle[] {
  const priced = communities.filter((c) => c.avgUnitPrice != null && c.avgUnitPrice > 0);
  if (priced.length === 0) return [];
  const maxCount = Math.max(1, ...communities.map((c) => c.listingCount));
  const minPrice = Math.min(...priced.map((c) => c.avgUnitPrice!));
  const maxPrice = Math.max(...priced.map((c) => c.avgUnitPrice!));
  return priced.map((c) => {
    const tPrice = normalizeRange(c.avgUnitPrice, minPrice, maxPrice);
    const tCount = c.listingCount / maxCount;
    return {
      longitude: c.lng,
      latitude: c.lat,
      color: HEAT_STROKE,
      fillColor: priceColorRamp5(tPrice),
      radius: heatRadius(tPrice, tCount),
      strokeWidth: 1
    };
  });
}

/** 挂牌数热力：全部社区 */
export function buildCountHeatCircles(communities: HeatCommunity[]): MapCircle[] {
  if (communities.length === 0) return [];
  const maxCount = Math.max(1, ...communities.map((c) => c.listingCount));
  return communities.map((c) => {
    const tCount = c.listingCount / maxCount;
    return {
      longitude: c.lng,
      latitude: c.lat,
      color: HEAT_STROKE,
      fillColor: countColorRamp(tCount),
      radius: 200 + Math.round(tCount * 800),
      strokeWidth: 1
    };
  });
}

function rgbToHexAlpha(r: number, g: number, b: number, alpha: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  const a = Math.max(0, Math.min(255, alpha)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${a}`;
}
