import { describe, expect, it } from "vitest";
import {
  getSchoolPremiumCommunityByDistrict,
  getSchoolPremiumCommunityTopByScore,
  getSchoolPremiumDistrictByCityTop,
  getSchoolPremiumDistrictCrossCityByDistrict,
  getSchoolPremiumThreeTierConsistency,
  summarizeSchoolPremiumCommunityByCity,
  summarizeSchoolPremiumDistrictByCity
} from "../src/local/schoolPremiumRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalSchoolPremiumCommunity,
  LocalSchoolPremiumDistrict
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

function SPC(
  communityId: number,
  cityId: number,
  districtName: string,
  communityName: string,
  schoolCount: number,
  avgSchoolScore: number,
  listingCount: number,
  medianUnitPrice: number
): LocalSchoolPremiumCommunity {
  return {
    communityId,
    cityId,
    districtName,
    communityName,
    schoolCount,
    avgSchoolScore,
    listingCount,
    medianUnitPrice
  };
}

function SPD(
  cityId: number,
  districtName: string,
  schoolCount: number,
  avgSchoolScore: number,
  listingCount: number,
  medianUnitPrice: number,
  cityMedianUnitPrice: number,
  premiumRatio: number
): LocalSchoolPremiumDistrict {
  return {
    cityId,
    districtName,
    schoolCount,
    avgSchoolScore,
    listingCount,
    medianUnitPrice,
    cityMedianUnitPrice,
    premiumRatio
  };
}

describe("schoolPremiumRanking - community 级", () => {
  it("summarizeSchoolPremiumCommunityByCity 加权均价 + top", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumCommunities = [
      SPC(1, 2, "南山区", "A", 4, 86.3, 52, 97005),
      SPC(2, 2, "南山区", "B", 4, 86.3, 61, 118138),
      SPC(3, 2, "福田区", "C", 10, 84.59, 53, 103473),
      SPC(4, 1, "天河区", "D", 3, 86.03, 111, 71692)
    ];
    setSnapshot(snap);

    const sum = summarizeSchoolPremiumCommunityByCity();
    expect(sum).toHaveLength(2);
    // 按 avgSchoolScore 倒序
    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.communityCount).toBe(3);
    expect(sz.avgSchoolScore).toBeCloseTo(85.73, 1); // (86.3+86.3+84.59)/3
    expect(sz.totalListings).toBe(166); // 52+61+53
    // 加权均价 = (97005*52 + 118138*61 + 103473*53) / 166 ≈ 106835.83
    expect(sz.weightedMedianPrice).toBeCloseTo(106835.83, 0);
    expect(sz.topCommunity?.communityName).toBe("A"); // 86.3 (tie with B)

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.communityCount).toBe(1);
  });

  it("getSchoolPremiumCommunityTopByScore 全市 / city 过滤", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumCommunities = [
      SPC(1, 2, "南山区", "A", 4, 86.3, 52, 97005),
      SPC(2, 2, "南山区", "B", 4, 86.3, 61, 118138),
      SPC(3, 1, "天河区", "D", 3, 86.03, 111, 71692),
      SPC(4, 1, "越秀区", "E", 5, 85.22, 103, 58026)
    ];
    setSnapshot(snap);

    const all = getSchoolPremiumCommunityTopByScore(null, 3);
    expect(all).toHaveLength(3);
    // 86.3 > 86.03 > 85.22
    expect(all[0]!.avgSchoolScore).toBeCloseTo(86.3, 5);
    expect(all[0]!.communityId).toBe(1); // stable: A before B
    expect(all[1]!.communityId).toBe(2);

    const city2 = getSchoolPremiumCommunityTopByScore(2, 5);
    expect(city2).toHaveLength(2);
    expect(city2.every((c) => c.cityId === 2)).toBe(true);
  });

  it("getSchoolPremiumCommunityByDistrict 单 district 全 community", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumCommunities = [
      SPC(1, 2, "南山区", "A", 4, 86.3, 52, 97005),
      SPC(2, 2, "南山区", "B", 4, 86.3, 61, 118138),
      SPC(3, 2, "福田区", "C", 10, 84.59, 53, 103473)
    ];
    setSnapshot(snap);

    const arr = getSchoolPremiumCommunityByDistrict(2, "南山区");
    expect(arr).toHaveLength(2);
    expect(arr.every((c) => c.districtName === "南山区")).toBe(true);
    expect(getSchoolPremiumCommunityByDistrict(2, "不存在的区")).toEqual([]);
  });
});

describe("schoolPremiumRanking - district 级", () => {
  it("summarizeSchoolPremiumDistrictByCity 加权 premiumRatio + top", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumDistricts = [
      // 广州
      SPD(1, "天河区", 3, 86.03, 111, 71692, 56301, 0.2734),
      SPD(1, "番禺区", 3, 82.6, 104, 35028, 56301, -0.3778),
      // 深圳
      SPD(2, "南山区", 4, 86.3, 177, 95513, 77552, 0.2316),
      SPD(2, "盐田区", 0, 0, 3, 38569, 77552, -0.5027)
    ];
    setSnapshot(snap);

    const sum = summarizeSchoolPremiumDistrictByCity();
    expect(sum).toHaveLength(2);

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.districtCount).toBe(2);
    // 加权 premium = (0.2734*111 + (-0.3778)*104) / (111+104) ≈ -0.0416
    expect(gz.weightedPremiumRatio).toBeCloseTo(-0.0416, 3);
    expect(gz.topDistrict?.districtName).toBe("天河区");

    const sz = sum.find((s) => s.cityId === 2)!;
    // (0.2316*177 + (-0.5027)*3) / 180 ≈ 0.2193
    expect(sz.weightedPremiumRatio).toBeCloseTo(0.2193, 3);
    expect(sz.topDistrict?.districtName).toBe("南山区");
  });

  it("getSchoolPremiumDistrictByCityTop 单 city 溢价榜", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumDistricts = [
      SPD(1, "天河区", 3, 86.03, 111, 71692, 56301, 0.2734),
      SPD(1, "番禺区", 3, 82.6, 104, 35028, 56301, -0.3778),
      SPD(1, "越秀区", 5, 85.22, 103, 58026, 56301, 0.0306),
      SPD(1, "海珠区", 1, 85.8, 113, 53467, 56301, -0.0503)
    ];
    setSnapshot(snap);

    const top = getSchoolPremiumDistrictByCityTop(1, 3);
    expect(top).toHaveLength(3);
    expect(top[0]!.districtName).toBe("天河区"); // 0.2734
    expect(top[1]!.districtName).toBe("越秀区"); // 0.0306
    expect(top[2]!.districtName).toBe("海珠区"); // -0.0503
  });

  it("getSchoolPremiumDistrictCrossCityByDistrict 同名区跨城对比", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumDistricts = [
      SPD(1, "南山区", 0, 0, 5, 50000, 56301, -0.1118),
      // 注意：广州没有真正的"南山区"，这里用模拟数据
      SPD(2, "南山区", 4, 86.3, 177, 95513, 77552, 0.2316)
    ];
    setSnapshot(snap);

    const cross = getSchoolPremiumDistrictCrossCityByDistrict("南山区");
    expect(cross).toHaveLength(2);
    expect(cross[0]!.cityId).toBe(2); // 深圳 23.16%
    expect(cross[1]!.cityId).toBe(1); // 广州 -11.18%
  });
});

describe("schoolPremiumRanking - 三级一致性", () => {
  it("getSchoolPremiumThreeTierConsistency 比较 community vs district listing 数之和", () => {
    const snap = emptySnapshot();
    // 一致：community 之和 = district 之和
    snap.schoolPremiumCommunities = [
      SPC(1, 2, "南山区", "A", 4, 86.3, 52, 97005),
      SPC(2, 2, "南山区", "B", 4, 86.3, 61, 118138), // 南山区合计 113
      SPC(3, 2, "福田区", "C", 10, 84.59, 53, 103473) // 福田区合计 53
    ];
    snap.schoolPremiumDistricts = [
      SPD(2, "南山区", 4, 86.3, 113, 95513, 77552, 0.2316),
      SPD(2, "福田区", 10, 84.59, 53, 103473, 77552, 0.334)
    ];
    setSnapshot(snap);

    const c = getSchoolPremiumThreeTierConsistency();
    expect(c).toHaveLength(1);
    expect(c[0]!.cityId).toBe(2);
    expect(c[0]!.communityListings).toBe(166);
    expect(c[0]!.districtListings).toBe(166);
    expect(c[0]!.consistent).toBe(true);
  });

  it("getSchoolPremiumThreeTierConsistency 不一致时正确标记", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumCommunities = [
      SPC(1, 2, "南山区", "A", 4, 86.3, 52, 97005)
    ];
    snap.schoolPremiumDistricts = [
      SPD(2, "南山区", 4, 86.3, 100, 95513, 77552, 0.2316) // 不一致：100 vs 52
    ];
    setSnapshot(snap);

    const c = getSchoolPremiumThreeTierConsistency();
    expect(c[0]!.consistent).toBe(false);
    expect(c[0]!.communityListings).toBe(52);
    expect(c[0]!.districtListings).toBe(100);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.schoolPremiumCommunities = [];
    snap.schoolPremiumDistricts = [];
    setSnapshot(snap);

    expect(summarizeSchoolPremiumCommunityByCity()).toEqual([]);
    expect(getSchoolPremiumCommunityTopByScore(null, 5)).toEqual([]);
    expect(getSchoolPremiumCommunityByDistrict(2, "南山区")).toEqual([]);
    expect(summarizeSchoolPremiumDistrictByCity()).toEqual([]);
    expect(getSchoolPremiumDistrictByCityTop(1, 5)).toEqual([]);
    expect(getSchoolPremiumDistrictCrossCityByDistrict("南山区")).toEqual([]);
    expect(getSchoolPremiumThreeTierConsistency()).toEqual([]);
  });
});