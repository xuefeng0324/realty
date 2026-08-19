/**
 * 70 城指数新鲜度（对照 hugohe3 / 统计局：上月数据约次月 15–17 日发布）
 * 验收：docs/HOUSING_PRICE_ACCEPTANCE.md Phase D
 */

/** 解析窄表 date → {y,m,d}；非法返回 null */
export function parseStats70Date(value: string): { y: number; m: number; d: number } | null {
  const parts = value.trim().split(/[/-]/).map(Number);
  if (parts.length < 2) return null;
  const [y, m, d = 1] = parts;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m, d: Number.isFinite(d) ? d : 1 };
}

export function formatStats70MonthLabel(value: string): string {
  const p = parseStats70Date(value);
  if (!p) return value;
  return `${p.y}年${p.m}月`;
}

/**
 * 按「发布滞后」推算当前应具备的最新数据月（每月 1 日表示）。
 * - 当月 day >= publishDay（默认 18）：应有上月
 * - 否则：应有上上月（给统计局/第三方整理留缓冲）
 */
export function expectedStats70Month(today: Date = new Date(), publishDay = 18): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-12
  const day = today.getDate();
  let ey = y;
  let em = m - (day >= publishDay ? 1 : 2);
  while (em <= 0) {
    em += 12;
    ey -= 1;
  }
  return `${ey}/${em}/1`;
}

export function compareStats70Month(a: string, b: string): number {
  const pa = parseStats70Date(a);
  const pb = parseStats70Date(b);
  if (!pa || !pb) return 0;
  return pa.y * 100 + pa.m - (pb.y * 100 + pb.m);
}

export type Stats70Freshness = {
  maxDate: string | null;
  expectedDate: string;
  status: Stats70FreshnessStatus;
  fresh: boolean;
  label: string;
};

export type Stats70FreshnessStatus = "fresh" | "waiting" | "stale" | "missing";

export function assessStats70Freshness(
  maxDate: string | null,
  today: Date = new Date(),
  publishDay = 18,
  deadlineDay = 20
): Stats70Freshness {
  const expectedDate = expectedStats70Month(today, publishDay);
  const parsedMaxDate = maxDate ? parseStats70Date(maxDate) : null;
  if (!maxDate || !parsedMaxDate) {
    return {
      maxDate: null,
      expectedDate,
      status: "missing",
      fresh: false,
      label: `暂无数据（期望至少 ${formatStats70MonthLabel(expectedDate)}）`
    };
  }
  const fresh = compareStats70Month(maxDate, expectedDate) >= 0;
  if (fresh) {
    return {
      maxDate,
      expectedDate,
      status: "fresh",
      fresh: true,
      label: `截至 ${formatStats70MonthLabel(maxDate)}（已跟上发布节奏）`
    };
  }

  const parsedExpectedDate = parseStats70Date(expectedDate);
  const monthGap = parsedExpectedDate
    ? parsedExpectedDate.y * 12 + parsedExpectedDate.m - (parsedMaxDate.y * 12 + parsedMaxDate.m)
    : Number.POSITIVE_INFINITY;
  const waiting =
    monthGap === 1 && today.getDate() >= publishDay && today.getDate() < deadlineDay;
  if (waiting) {
    return {
      maxDate,
      expectedDate,
      status: "waiting",
      fresh: false,
      label: `截至 ${formatStats70MonthLabel(maxDate)}（上月数据待发布，${deadlineDay} 日后再校验）`
    };
  }

  return {
    maxDate,
    expectedDate,
    status: "stale",
    fresh: false,
    label: `截至 ${formatStats70MonthLabel(maxDate)}（落后，期望 ≥ ${formatStats70MonthLabel(expectedDate)}）`
  };
}
