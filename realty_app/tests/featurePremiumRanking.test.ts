import { describe, expect, it } from "vitest";
import {
  getFeaturePremiumByCityDimension,
  getFeaturePremiumByDimensionCoverage,
  getFeaturePremiumCrossCityLeaderboard,
  getFeaturePremiumTopByDimension,
  summarizeFeaturePremiumByCity
} from "../src/local/featurePremiumRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalFeaturePremium } from "../src/local/types";

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

function FP(
  cityId: number,
  cityName: string,
  dimension: LocalFeaturePremium["dimension"],
  bucket: string,
  premiumPct: number,
  count = 100
): LocalFeaturePremium {
  return {
    cityId,
    cityName,
    dimension,
    bucket,
    count,
    share: 0.3,
    medianUnitPrice: 56301 * (1 + premiumPct / 100),
    cityMedianUnitPrice: 56301,
    premiumPct
  };
}

describe("featurePremiumRanking", () => {
  it("summarizeFeaturePremiumByCity 聚合每城 top / bottom / 平均溢价", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "orientation", "南", 5),
      FP(1, "广州", "orientation", "北", -3),
      FP(1, "广州", "decorate", "豪装", 8),
      FP(1, "广州", "decorate", "毛坯", -2),
      FP(2, "深圳", "orientation", "南", 7),
      FP(2, "深圳", "decorate", "豪装", 4)
    ];
    setSnapshot(snap);

    const sum = summarizeFeaturePremiumByCity();
    expect(sum).toHaveLength(2);
    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.topBucket?.bucket).toBe("豪装");
    expect(gz.topBucket?.premiumPct).toBe(8);
    expect(gz.bottomBucket?.bucket).toBe("北");
    expect(gz.bottomBucket?.premiumPct).toBe(-3);
    expect(gz.avgPremiumPct).toBeCloseTo(2, 5); // (5 - 3 + 8 - 2)/4 = 2

    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.topBucket?.premiumPct).toBe(7);
    expect(sz.avgPremiumPct).toBeCloseTo(5.5, 5);
  });

  it("getFeaturePremiumByCityDimension 按 premium 倒序", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "bedrooms", "2室", 2),
      FP(1, "广州", "bedrooms", "3室", -1),
      FP(1, "广州", "bedrooms", "4室", 5)
    ];
    setSnapshot(snap);

    const arr = getFeaturePremiumByCityDimension(1, "bedrooms");
    expect(arr).toHaveLength(3);
    expect(arr[0]!.bucket).toBe("4室");
    expect(arr[0]!.premiumPct).toBe(5);
    expect(arr[2]!.bucket).toBe("3室");
  });

  it("getFeaturePremiumByCityDimension 按 bucket 名字排序", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "decorate", "毛坯", -2),
      FP(1, "广州", "decorate", "豪装", 5),
      FP(1, "广州", "decorate", "精装", 0)
    ];
    setSnapshot(snap);

    const arr = getFeaturePremiumByCityDimension(1, "decorate", { sort: "bucket" });
    // 验证按 localeCompare 排序后，桶名顺序与逐字 localeCompare 一致
    const expected = ["毛坯", "豪装", "精装"]
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
      .map((name) => arr.find((x) => x.bucket === name)!);
    expect(expected.length).toBe(3);
    expect(expected.every((x) => x !== undefined)).toBe(true);
    expect(arr[0]!.bucket).toBe(expected[0]!.bucket);
    expect(arr[2]!.bucket).toBe(expected[2]!.bucket);
  });

  it("getFeaturePremiumTopByDimension 单 bucket 返回", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "orientation", "南", 2),
      FP(1, "广州", "orientation", "东南", 8),
      FP(1, "广州", "orientation", "北", -1)
    ];
    setSnapshot(snap);

    const top = getFeaturePremiumTopByDimension(1, "orientation");
    expect(top).not.toBeNull();
    expect(top!.bucket).toBe("东南");
    expect(top!.premiumPct).toBe(8);

    expect(getFeaturePremiumTopByDimension(99, "orientation")).toBeNull();
  });

  it("getFeaturePremiumCrossCityLeaderboard 跨城最强组合", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "decorate", "豪装", 5),
      FP(2, "深圳", "decorate", "豪装", 10),
      FP(3, "珠海", "decorate", "豪装", 3)
    ];
    setSnapshot(snap);

    const lb = getFeaturePremiumCrossCityLeaderboard("decorate");
    expect(lb.dimension).toBe("decorate");
    expect(lb.rows).toHaveLength(3);
    expect(lb.rows[0]!.cityName).toBe("深圳");
    expect(lb.rows[0]!.premiumPct).toBe(10);
    expect(lb.rows[1]!.cityName).toBe("广州");
    expect(lb.rows[2]!.cityName).toBe("珠海");
  });

  it("getFeaturePremiumByDimensionCoverage 按绝对值倒序取 Top N", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [
      FP(1, "广州", "orientation", "南", 5),
      FP(1, "广州", "decorate", "豪装", 8),
      FP(1, "广州", "orientation", "北", -10) // 绝对值最大
    ];
    setSnapshot(snap);

    const cov = getFeaturePremiumByDimensionCoverage(2);
    expect(cov).toHaveLength(2);
    expect(cov[0]!.bucket).toBe("北"); // 绝对值 -10 最高
    expect(cov[1]!.bucket).toBe("豪装"); // +8 第二
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.featurePremia = [];
    setSnapshot(snap);

    expect(summarizeFeaturePremiumByCity()).toEqual([]);
    expect(getFeaturePremiumByCityDimension(1, "bedrooms")).toEqual([]);
    expect(getFeaturePremiumTopByDimension(1, "bedrooms")).toBeNull();
    expect(getFeaturePremiumCrossCityLeaderboard("decorate").rows).toEqual([]);
    expect(getFeaturePremiumByDimensionCoverage(5)).toEqual([]);
  });
});