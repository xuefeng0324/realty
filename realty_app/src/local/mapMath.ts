export function normalizeRange(value: number | null | undefined, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.max(0, Math.min(1, ((value as number) - min) / (max - min)));
}

export function heatRadius(priceRatio: number, countRatio: number): number {
  const price = Math.max(0, Math.min(1, priceRatio));
  const count = Math.max(0, Math.min(1, countRatio));
  return 200 + Math.round((0.3 * price + 0.7 * count) * 800);
}
