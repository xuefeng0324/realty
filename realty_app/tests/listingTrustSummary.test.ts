import { describe, expect, it } from "vitest";
import {
  formatListingTrustLine,
  summarizeListingTrust
} from "../src/local/listingTrustSummary";
import type { LocalListing } from "../src/local/types";

function listing(partial: Partial<LocalListing> & Pick<LocalListing, "sourceKind">): LocalListing {
  return {
    listingId: partial.listingId ?? 1,
    cityId: partial.cityId ?? 2,
    communityId: partial.communityId ?? 1,
    title: partial.title ?? "t",
    source: partial.source ?? "链家在售",
    sourceKind: partial.sourceKind,
    sourceListingId: partial.sourceListingId ?? null,
    sourceUrl: partial.sourceUrl ?? null,
    totalPrice10k: partial.totalPrice10k ?? 500,
    unitPrice: partial.unitPrice ?? 50000,
    areaSqm: partial.areaSqm ?? 80,
    listingType: partial.listingType ?? null,
    bedrooms: partial.bedrooms ?? 2,
    bathrooms: partial.bathrooms ?? 1,
    orientation: partial.orientation ?? null,
    floorNumber: partial.floorNumber ?? null,
    hasElevator: partial.hasElevator ?? null,
    decorateType: partial.decorateType ?? null,
    buildYear: partial.buildYear ?? null,
    nearestMetroDistanceM: partial.nearestMetroDistanceM ?? null,
    schoolIdsJson: partial.schoolIdsJson ?? null,
    tagsJson: partial.tagsJson ?? null,
    crawlDate: partial.crawlDate ?? null
  };
}

describe("listingTrustSummary", () => {
  it("统计 REAL/DERIVED 占比与最新 REAL crawl_date", () => {
    const s = summarizeListingTrust([
      listing({ listingId: 1, sourceKind: "REAL", crawlDate: "2026-07-10" }),
      listing({ listingId: 2, sourceKind: "REAL", crawlDate: "2026-07-12" }),
      listing({ listingId: 3, sourceKind: "DERIVED", crawlDate: "2026-07-18" }),
      listing({ listingId: 4, sourceKind: "UNKNOWN", crawlDate: null })
    ]);
    expect(s.total).toBe(4);
    expect(s.real).toBe(2);
    expect(s.derived).toBe(1);
    expect(s.other).toBe(1);
    expect(s.realPct).toBe(50);
    expect(s.latestCrawlDate).toBe("2026-07-18");
    expect(s.latestRealCrawlDate).toBe("2026-07-12");
  });

  it("空列表安全", () => {
    const s = summarizeListingTrust([]);
    expect(s.realPct).toBe(0);
    expect(s.latestRealCrawlDate).toBeNull();
    expect(formatListingTrustLine(s)).toContain("暂无");
  });

  it("短文案含真实挂牌占比与日期", () => {
    const line = formatListingTrustLine(
      summarizeListingTrust([
        listing({ sourceKind: "REAL", crawlDate: "2026-07-12" }),
        listing({ listingId: 9, sourceKind: "DERIVED", crawlDate: "2026-01-01" })
      ])
    );
    expect(line).toContain("真实挂牌");
    expect(line).toContain("50%");
    expect(line).toContain("2026-07-12");
  });
});
