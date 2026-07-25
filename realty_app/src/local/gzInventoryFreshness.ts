/**
 * 广州新房库存新鲜度（源站日更；CI 工作日拉取并 merge）
 * 验收：docs/FEATURE_CATALOG.md F-DASH-11 / HOUSING_PRICE_ACCEPTANCE Phase E
 */

export type GzInventoryFreshness = {
  latestDate: string | null;
  ageDays: number | null;
  /** 超过 softDays 视为滞后（默认 3 个自然日） */
  stale: boolean;
  label: string;
};

export function assessGzInventoryFreshness(
  latestDate: string | null,
  today: Date = new Date(),
  staleDays = 3
): GzInventoryFreshness {
  if (!latestDate || !/^\d{4}-\d{2}-\d{2}$/.test(latestDate)) {
    return {
      latestDate: null,
      ageDays: null,
      stale: true,
      label: "广州库存：无有效快照"
    };
  }
  const [y, m, d] = latestDate.split("-").map(Number);
  const latest = new Date(y!, m! - 1, d!);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ageDays = Math.max(0, Math.round((startToday.getTime() - latest.getTime()) / 86400000));
  const stale = ageDays > staleDays;
  return {
    latestDate,
    ageDays,
    stale,
    label: stale
      ? `截至 ${latestDate}（源站已 ${ageDays} 天未更新）`
      : `截至 ${latestDate}`
  };
}
