import { describe, expect, it } from "vitest";
import {
  getAllDistributionRows,
  getDistributionByCityDimension,
  getDistributionCrossCityLeaderboard,
  getDistributionShareLeaderboard,
  getDistributionTopByMedianPrice,
  summarizeDistributionByCity
} from "../src/local/distributionRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalBedroomArea,
  LocalDecorateAge,
  LocalLayoutDistribution
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

function LD(
  cityId: number,
  cityName: string,
  dimension: LocalLayoutDistribution["dimension"],
  bucket: string,
  count: number,
  share: number,
  medianUnitPrice: number | null = 50000
): LocalLayoutDistribution {
  return {
    cityId,
    cityName,
    dimension,
    bucket,
    count,
    share,
    medianUnitPrice,
    avgAreaSqm: 80
  };
}

function BA(
  cityId: number,
  cityName: string,
  bedrooms: number,
  areaBucket: string,
  count: number,
  share: number,
  medianUnitPrice: number
): LocalBedroomArea {
  return {
    cityId,
    cityName,
    bedrooms,
    areaBucket,
    count,
    share,
    medianUnitPrice
  };
}

function DA(
  cityId: number,
  cityName: string,
  decorate: string,
  ageBucket: string,
  count: number,
  share: number,
  medianUnitPrice: number,
  premiumPct: number
): LocalDecorateAge {
  return {
    cityId,
    cityName,
    decorate,
    ageBucket,
    count,
    share,
    medianUnitPrice,
    premiumPct
  };
}

describe("distributionRanking - 3 个分布数据源通用派生", () => {
  it("getAllDistributionRows 合并 3 个数据集", () => {
    const snap = emptySnapshot();
    snap.layoutDistributions = [LD(1, "广州", "bedrooms", "3室", 100, 0.3)];
    snap.bedroomArea = [BA(1, "广州", 2, "50-80", 50, 0.15, 45000)];
    snap.decorateAge = [DA(1, "广州", "精装", "5-10年", 30, 0.1, 55000, 5)];
    setSnapshot(snap);

    const all = getAllDistributionRows();
    expect(all).toHaveLength(3);
  });

  it("summarizeDistributionByCity 加权平均价 + 城市排序", () => {
    const snap = emptySnapshot();
    snap.bedroomArea = [
      BA(1, "广州", 2, "50-80", 100, 0.5, 40000), // 占 100
      BA(1, "广州", 3, "80-110", 200, 0.5, 60000), // 占 200
      BA(2, "深圳", 2, "50-80", 50, 1, 90000)
    ];
    setSnapshot(snap);

    const sum = summarizeDistributionByCity();
    expect(sum).toHaveLength(2);
    const gz = sum.find((s) => s.cityId === 1)!;
    // 加权均价 = (40000*100 + 60000*200) / 300 = 53333.33
    expect(gz.weightedMedianPrice).toBeCloseTo(53333.33, 1);
    expect(gz.totalListings).toBe(300);
    expect(gz.avgPremiumPct).toBeNull(); // bedroom_area 没 premiumPct
  });

  it("summarizeDistributionByCity decorate_age 含 avgPremiumPct", () => {
    const snap = emptySnapshot();
    snap.decorateAge = [
      DA(1, "广州", "精装", "5-10年", 100, 0.5, 55000, 5),
      DA(1, "广州", "豪装", "5-10年", 50, 0.3, 65000, 10),
      DA(1, "广州", "毛坯", "20年以上", 20, 0.2, 35000, -15)
    ];
    setSnapshot(snap);

    const sum = summarizeDistributionByCity();
    expect(sum).toHaveLength(1);
    expect(sum[0]!.avgPremiumPct).toBeCloseTo(0, 5); // (5+10-15)/3 = 0
  });

  it("getDistributionByCityDimension 按 dimension 过滤 + count 倒序", () => {
    const snap = emptySnapshot();
    snap.layoutDistributions = [
      LD(1, "广州", "orientation", "南", 100, 0.3, 50000),
      LD(1, "广州", "orientation", "北", 50, 0.15, 40000),
      LD(1, "广州", "orientation", "南北通透", 200, 0.55, 55000),
      LD(1, "广州", "bedrooms", "2室", 80, 0.2, 45000)
    ];
    setSnapshot(snap);

    const orient = getDistributionByCityDimension(1, "orientation");
    expect(orient).toHaveLength(3);
    expect(orient[0]!.bucket).toBe("南北通透"); // 200
    expect(orient[1]!.bucket).toBe("南"); // 100

    const byShare = getDistributionByCityDimension(1, "orientation", undefined, "share");
    expect(byShare[0]!.bucket).toBe("南北通透"); // share 0.55
  });

  it("getDistributionTopByMedianPrice 按 medianUnitPrice 倒序 + null 末尾", () => {
    const snap = emptySnapshot();
    snap.layoutDistributions = [
      LD(1, "广州", "bedrooms", "2室", 80, 0.2, 45000),
      LD(1, "广州", "bedrooms", "3室", 200, 0.5, null), // null
      LD(1, "广州", "bedrooms", "4室", 50, 0.15, 70000)
    ];
    setSnapshot(snap);

    const top = getDistributionTopByMedianPrice(1, 5);
    expect(top).toHaveLength(3);
    expect((top[0] as LocalLayoutDistribution).bucket).toBe("4室"); // 70000
    expect(top[2]!.medianUnitPrice).toBeNull(); // null 末尾
  });

  it("getDistributionCrossCityLeaderboard 跨城对比相同 bucket", () => {
    const snap = emptySnapshot();
    snap.layoutDistributions = [
      LD(1, "广州", "orientation", "南", 100, 0.3, 50000),
      LD(2, "深圳", "orientation", "南", 200, 0.4, 80000),
      LD(3, "珠海", "orientation", "南", 50, 0.2, 30000)
    ];
    setSnapshot(snap);

    const lb = getDistributionCrossCityLeaderboard("orientation", "南");
    expect(lb).toHaveLength(3);
    expect(lb[0]!.cityName).toBe("深圳"); // 80000
    expect(lb[1]!.cityName).toBe("广州"); // 50000
    expect(lb[2]!.cityName).toBe("珠海"); // 30000
  });

  it("getDistributionShareLeaderboard 跨城对比 dim1 占比", () => {
    const snap = emptySnapshot();
    snap.bedroomArea = [
      BA(1, "广州", 2, "50-80", 100, 0.5),
      BA(2, "深圳", 2, "50-80", 200, 0.4),
      BA(3, "珠海", 2, "50-80", 30, 0.6)
    ];
    setSnapshot(snap);

    const lb = getDistributionShareLeaderboard("2室");
    expect(lb).toHaveLength(3);
    expect(lb[0]!.cityName).toBe("珠海"); // share 0.6
    expect(lb[1]!.cityName).toBe("广州"); // share 0.5
    expect(lb[2]!.cityName).toBe("深圳"); // share 0.4
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    setSnapshot(snap);

    expect(getAllDistributionRows()).toEqual([]);
    expect(summarizeDistributionByCity()).toEqual([]);
    expect(getDistributionByCityDimension(1, "orientation")).toEqual([]);
    expect(getDistributionTopByMedianPrice(1, 5)).toEqual([]);
    expect(getDistributionCrossCityLeaderboard("orientation", "南")).toEqual([]);
    expect(getDistributionShareLeaderboard("2室")).toEqual([]);
  });
});