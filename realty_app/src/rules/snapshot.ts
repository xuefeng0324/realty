/**
 * weekly_snapshot 规则，对应 Python 端 `realty/backend/app/services/snapshot_service.py`。
 *
 * 输入：一周窗口内的 listings（按 crawl_date desc 排序后的 unit_price 列表）
 * 输出：avg_unit_price / median_unit_price / listing_count / coverage_score / data_policy
 */

export interface SnapshotInput {
  communityId: number;
  weekEndDate: string; // ISO 'YYYY-MM-DD'
  unitPrices: number[]; // 已经按 crawl_date desc 排序后的 unit_price 列表
}

export interface SnapshotResult {
  communityId: number;
  weekEndDate: string;
  weekStartDate: string;
  avgUnitPrice: number;
  medianUnitPrice: number;
  listingCount: number;
  coverageScore: number;
  dataPolicy: string;
  sourcePriorityUsed: string;
}

export const SNAPSHOT_DEFAULTS = {
  unitPriceMin: 1000.0,
  unitPriceMax: 200000.0,
  minSamplesForLatest: 5,
  targetListingCount: 30.0,
  deviationThreshold: 0.25,
  coverageLowConfThreshold: 0.2
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function computeWeekWindow(weekEndDate: string): { start: string; end: string } {
  const end = new Date(weekEndDate + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function selectPolicyAndAvg(
  prices: number[],
  latestPrice: number,
  minSamplesForLatest: number,
  deviationThreshold: number
): { policy: string; avg: number; median: number } {
  const medianPrice = median(prices);
  if (prices.length < minSamplesForLatest) {
    return { policy: "median_robust", avg: medianPrice, median: medianPrice };
  }
  if (medianPrice === 0) {
    return { policy: "median_robust", avg: medianPrice, median: medianPrice };
  }
  const deviation = Math.abs(latestPrice - medianPrice) / medianPrice;
  if (deviation > deviationThreshold) {
    return { policy: "median_robust", avg: medianPrice, median: medianPrice };
  }
  return { policy: "latest_non_null", avg: latestPrice, median: medianPrice };
}

export function generateWeeklySnapshot(input: SnapshotInput): SnapshotResult | null {
  const { start, end } = computeWeekWindow(input.weekEndDate);
  const prices = input.unitPrices.filter(
    (p) => p >= SNAPSHOT_DEFAULTS.unitPriceMin && p <= SNAPSHOT_DEFAULTS.unitPriceMax
  );
  if (prices.length === 0) return null;

  const latestPrice = prices[0];
  const { policy, avg, median: med } = selectPolicyAndAvg(
    prices,
    latestPrice,
    SNAPSHOT_DEFAULTS.minSamplesForLatest,
    SNAPSHOT_DEFAULTS.deviationThreshold
  );
  const listingCount = prices.length;
  const coverageScore = Math.min(1.0, listingCount / SNAPSHOT_DEFAULTS.targetListingCount);

  return {
    communityId: input.communityId,
    weekEndDate: end,
    weekStartDate: start,
    avgUnitPrice: avg,
    medianUnitPrice: med,
    listingCount,
    coverageScore,
    dataPolicy: policy,
    sourcePriorityUsed: "listing_detail_unit_price"
  };
}