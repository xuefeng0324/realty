import { describe, expect, it } from "vitest";
import {
  aggregateListingSchoolPremiumByCommunity,
  getListingSchoolPremiumByCityDistrict,
  getListingSchoolPremiumByCommunityLeaderboard,
  getListingSchoolPremiumDistribution,
  summarizeListingSchoolPremiumByCity
} from "../src/local/listingSchoolPremiumRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalListingSchoolPremium
} from "../src/local/types";

function emptySnapshot(): DataSnapshot {
  return {
    importedAt: "1970-01-01T00:00:00Z",
    source: "test",
    cities: [],
    communities: [],
    districts: [],
    listings: [],
    schools: [],
    indicators: [],
    districtPolygons: [],
    metroWalks: [],
    metroLines: [],
    poiClues: [],
    climate: { cities: [], globalIndex: { source: "test", updatedAt: "1970-01-01" } },
    wangqianDaily: [],
    nbsRealEstate: [],
    gzNewHouseInventory: [],
    providentFundRates: [],
    educationOverview: [],
    schoolSourceAudit: [],
    communityAliasSuggestions: [],
    districtIndices: [],
    districtMeta: [],
    index70: [],
    districtTrends: [],
    schoolIndicators: [],
    schoolDimensions: [],
    listingFreshness: [],
    listingTagSummaries: [],
    poiMarkets: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function SP(
  listingId: number,
  cityId: number,
  districtName: string,
  communityId: number,
  premiumRatioEst: number,
  schoolCount = 3,
  avgSchoolScore = 80
): LocalListingSchoolPremium {
  return {
    listingId,
    cityId,
    districtName,
    communityId,
    schoolCount,
    avgSchoolScore,
    premiumRatioEst
  };
}

describe("listingSchoolPremiumRanking", () => {
  it("summarizeListingSchoolPremiumByCity 聚合 + 高溢价占比 + top listing", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [
      // 深圳南山区：典型高溢价学区
      SP(1, 2, "南山区", 1, 25),
      SP(2, 2, "南山区", 1, 21),
      SP(3, 2, "南山区", 2, 18),
      // 广州天河区：中等溢价
      SP(4, 1, "天河区", 3, 5),
      SP(5, 1, "天河区", 3, 8),
      // 珠海香洲区：折价（学区房反而不贵）
      SP(6, 3, "香洲区", 4, -3)
    ];
    setSnapshot(snap);

    const sum = summarizeListingSchoolPremiumByCity();
    expect(sum).toHaveLength(3);
    // 按 avgPremiumPct 倒序
    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.listingCount).toBe(3);
    expect(sz.premiumListingCount).toBe(3);
    expect(sz.avgPremiumPct).toBeCloseTo((25 + 21 + 18) / 3, 5);
    expect(sz.highPremiumShare).toBe(1); // 全 >10
    expect(sz.topListing?.premiumRatioEst).toBe(25);

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.avgPremiumPct).toBeCloseTo(6.5, 5);
    expect(gz.highPremiumShare).toBe(0); // 全 <10

    const zh = sum.find((s) => s.cityId === 3)!;
    expect(zh.avgPremiumPct).toBeCloseTo(-3, 5);
  });

  it("aggregateListingSchoolPremiumByCommunity 同 community 多 listing 聚合", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [
      SP(1, 2, "南山区", 1, 25, 4, 86),
      SP(2, 2, "南山区", 1, 21, 4, 86),
      SP(3, 2, "南山区", 2, 18, 4, 86)
    ];
    setSnapshot(snap);

    const arr = aggregateListingSchoolPremiumByCommunity(2);
    expect(arr).toHaveLength(2);
    const c1 = arr.find((x) => x.communityId === 1)!;
    expect(c1.listingCount).toBe(2);
    expect(c1.avgPremiumPct).toBeCloseTo(23, 5);
    expect(c1.topListing.premiumRatioEst).toBe(25);

    // cityId 不传：全量
    const all = aggregateListingSchoolPremiumByCommunity();
    expect(all).toHaveLength(2);
  });

  it("getListingSchoolPremiumByCommunityLeaderboard 取平均溢价 Top N", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [
      SP(1, 2, "南山区", 1, 25),
      SP(2, 2, "南山区", 1, 21),
      SP(3, 2, "南山区", 2, 5),
      SP(4, 2, "南山区", 2, 8),
      SP(5, 2, "南山区", 3, 30),
      SP(6, 2, "南山区", 3, 35)
    ];
    setSnapshot(snap);

    const lb = getListingSchoolPremiumByCommunityLeaderboard(2, 3);
    expect(lb).toHaveLength(3);
    expect(lb[0]!.communityId).toBe(3); // avg 32.5
    expect(lb[1]!.communityId).toBe(1); // avg 23
    expect(lb[2]!.communityId).toBe(2); // avg 6.5
  });

  it("getListingSchoolPremiumByCityDistrict 区分 city × district 聚合", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [
      SP(1, 2, "南山区", 1, 25),
      SP(2, 2, "南山区", 2, 15),
      SP(3, 2, "福田区", 3, 8),
      SP(4, 1, "天河区", 4, 5),
      SP(5, 1, "越秀区", 5, 30)
    ];
    setSnapshot(snap);

    const byCity = getListingSchoolPremiumByCityDistrict(2);
    expect(byCity).toHaveLength(2);
    expect(byCity[0]!.districtName).toBe("南山区"); // 高溢价
    expect(byCity[0]!.avgPremiumPct).toBeCloseTo(20, 5);
    expect(byCity[0]!.communityCount).toBe(2);
    expect(byCity[1]!.districtName).toBe("福田区");
    expect(byCity[1]!.avgPremiumPct).toBe(8);

    // 全量
    const all = getListingSchoolPremiumByCityDistrict();
    expect(all).toHaveLength(4);
    expect(all[0]!.avgPremiumPct).toBe(30); // 越秀区第一
  });

  it("getListingSchoolPremiumDistribution 4 桶分布", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [
      SP(1, 2, "南山区", 1, 35), // ≥30
      SP(2, 2, "南山区", 1, 28), // 10-30
      SP(3, 2, "南山区", 2, 15), // 10-30
      SP(4, 2, "南山区", 2, 5),  // 0-10
      SP(5, 2, "南山区", 3, -3)  // <0
    ];
    setSnapshot(snap);

    const dist = getListingSchoolPremiumDistribution(2);
    expect(dist).toHaveLength(4);
    expect(dist[0]!.bucket).toBe("≥30");
    expect(dist[0]!.count).toBe(1);
    expect(dist[0]!.share).toBeCloseTo(0.2, 5);

    expect(dist[1]!.bucket).toBe("10-30");
    expect(dist[1]!.count).toBe(2);
    expect(dist[1]!.share).toBeCloseTo(0.4, 5);

    expect(dist[2]!.bucket).toBe("0-10");
    expect(dist[2]!.count).toBe(1);

    expect(dist[3]!.bucket).toBe("<0");
    expect(dist[3]!.count).toBe(1);

    // 全量也跑得通
    const all = getListingSchoolPremiumDistribution();
    expect(all[0]!.count).toBe(1);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.listingSchoolPremia = [];
    setSnapshot(snap);

    expect(summarizeListingSchoolPremiumByCity()).toEqual([]);
    expect(aggregateListingSchoolPremiumByCommunity()).toEqual([]);
    expect(getListingSchoolPremiumByCommunityLeaderboard(2, 5)).toEqual([]);
    expect(getListingSchoolPremiumByCityDistrict()).toEqual([]);
    expect(getListingSchoolPremiumDistribution()).toEqual([]);
  });
});