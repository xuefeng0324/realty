/**
 * 挂牌可信度摘要：REAL/DERIVED 占比 + 最新真实挂牌 crawl_date
 * 对照：docs/HOUSING_PRICE_ACCEPTANCE.md Phase C
 */
import type { ListingSourceKind, LocalListing } from "./types";
import { listingSourceKindLabel } from "./listingSource";

export type ListingTrustSummary = {
  total: number;
  real: number;
  derived: number;
  other: number;
  /** REAL / total，0～100，total=0 时为 0 */
  realPct: number;
  /** 全部挂牌中最新 crawl_date（含 DERIVED） */
  latestCrawlDate: string | null;
  /** 仅 REAL 的最新 crawl_date */
  latestRealCrawlDate: string | null;
};

function isKind(row: LocalListing, kind: ListingSourceKind): boolean {
  return row.sourceKind === kind;
}

export function summarizeListingTrust(listings: readonly LocalListing[]): ListingTrustSummary {
  let real = 0;
  let derived = 0;
  let other = 0;
  let latestCrawlDate: string | null = null;
  let latestRealCrawlDate: string | null = null;

  for (const row of listings) {
    if (isKind(row, "REAL")) real++;
    else if (isKind(row, "DERIVED")) derived++;
    else other++;

    const d = row.crawlDate;
    if (d) {
      if (!latestCrawlDate || d > latestCrawlDate) latestCrawlDate = d;
      if (isKind(row, "REAL") && (!latestRealCrawlDate || d > latestRealCrawlDate)) {
        latestRealCrawlDate = d;
      }
    }
  }

  const total = listings.length;
  const realPct = total === 0 ? 0 : Math.round((real / total) * 1000) / 10;

  return {
    total,
    real,
    derived,
    other,
    realPct,
    latestCrawlDate,
    latestRealCrawlDate
  };
}

/** 设置页 / 工作台短文案 */
export function formatListingTrustLine(s: ListingTrustSummary): string {
  if (s.total === 0) return "暂无挂牌样本";
  const realLabel = listingSourceKindLabel("REAL");
  const derivedLabel = listingSourceKindLabel("DERIVED");
  const realDate = s.latestRealCrawlDate ? `；真实挂牌最新 ${s.latestRealCrawlDate}` : "；尚无真实挂牌日期";
  return (
    `${realLabel} ${s.real}（${s.realPct}%）/ ${derivedLabel} ${s.derived} / 其他 ${s.other}` +
    realDate
  );
}
