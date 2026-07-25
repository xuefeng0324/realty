import { describe, expect, it } from "vitest";
import {
  getCommunityScatterByAreaCohort,
  getCommunityScatterByCityTotalPriceExtremes,
  getCommunityScatterByQuadrant,
  getCommunityScatterCrossCityByQuadrant,
  getCommunityScatterPareto,
  summarizeCommunityScatterByCity,
  summarizeCommunityScatterByCityAreaCohort,
  summarizeCommunityScatterByCityQuadrant
} from "../src/local/communityScatterRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalCommunityScatter
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

function CS(
  cityId: number,
  cityName: string,
  communityId: number,
  communityName: string,
  districtName: string,
  count: number,
  medianUnitPrice: number,
  medianTotalPrice10w: number,
  medianArea: number,
  areaCohort: string,
  quadrant: string
): LocalCommunityScatter {
  return {
    cityId,
    cityName,
    communityId,
    communityName,
    districtName,
    count,
    medianUnitPrice,
    medianTotalPrice10w,
    medianArea,
    areaCohort,
    quadrant
  };
}

describe("communityScatterRanking", () => {
  it("summarizeCommunityScatterByCity 聚合 + 象限分布 + 面积段分布", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 707, 94, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "天河区", 56, 69946, 701, 100, "改善", "豪宅板块"),
      CS(1, "广州", 3, "C", "番禺区", 52, 36730, 346, 93, "改善", "价值洼地"),
      CS(2, "深圳", 4, "D", "南山区", 61, 118138, 1142, 94, "改善", "豪宅板块"),
      CS(2, "深圳", 5, "E", "宝安区", 60, 80000, 800, 100, "改善", "改善低密")
    ];
    setSnapshot(snap);

    const sum = summarizeCommunityScatterByCity();
    expect(sum).toHaveLength(2);
    // 按 avgUnitPrice 倒序
    expect(sum[0]!.cityId).toBe(2); // 深圳 2 个区均价更高
    expect(sum[0]!.communityCount).toBe(2);
    expect(sum[0]!.quadrantDistribution["豪宅板块"]).toBe(1);
    expect(sum[0]!.quadrantDistribution["改善低密"]).toBe(1);
    expect(sum[0]!.areaCohortDistribution["改善"]).toBe(2);

    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.communityCount).toBe(3);
    expect(gz.quadrantDistribution["豪宅板块"]).toBe(2);
    expect(gz.quadrantDistribution["价值洼地"]).toBe(1);
  });

  it("summarizeCommunityScatterByCityQuadrant 象限聚合", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 707, 94, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "天河区", 56, 69946, 701, 100, "改善", "豪宅板块"),
      CS(1, "广州", 3, "C", "番禺区", 52, 36730, 346, 93, "改善", "价值洼地"),
      CS(2, "深圳", 4, "D", "南山区", 61, 118138, 1142, 94, "改善", "豪宅板块")
    ];
    setSnapshot(snap);

    const arr = summarizeCommunityScatterByCityQuadrant();
    expect(arr.length).toBeGreaterThanOrEqual(3);
    const gzHaoshe = arr.find(
      (x) => x.cityId === 1 && x.quadrant === "豪宅板块"
    );
    expect(gzHaoshe).toBeDefined();
    expect(gzHaoshe!.communityCount).toBe(2);
    expect(gzHaoshe!.avgUnitPrice).toBeCloseTo(73090, 0);
  });

  it("summarizeCommunityScatterByCityAreaCohort 面积段聚合", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 707, 94, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "天河区", 56, 69946, 350, 50, "小户型(<60)", "价值洼地"),
      CS(2, "深圳", 4, "D", "南山区", 61, 118138, 1300, 110, "大户型(>110)", "豪宅板块")
    ];
    setSnapshot(snap);

    const arr = summarizeCommunityScatterByCityAreaCohort();
    expect(arr.length).toBeGreaterThanOrEqual(3);
    const gzSmall = arr.find(
      (x) => x.cityId === 1 && x.areaCohort === "小户型(<60)"
    );
    expect(gzSmall!.communityCount).toBe(1);
    expect(gzSmall!.avgTotalPrice10w).toBeCloseTo(350, 0);
  });

  it("getCommunityScatterByQuadrant 按象限 + city 过滤", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 707, 94, "改善", "豪宅板块"),
      CS(2, "深圳", 4, "D", "南山区", 61, 118138, 1142, 94, "改善", "豪宅板块")
    ];
    setSnapshot(snap);

    const all = getCommunityScatterByQuadrant("豪宅板块");
    expect(all).toHaveLength(2);
    const gzOnly = getCommunityScatterByQuadrant("豪宅板块", 1);
    expect(gzOnly).toHaveLength(1);
    expect(gzOnly[0]!.cityName).toBe("广州");
  });

  it("getCommunityScatterByAreaCohort 按面积段", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 707, 94, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "天河区", 56, 69946, 350, 50, "小户型(<60)", "价值洼地"),
      CS(2, "深圳", 3, "C", "宝安区", 60, 80000, 750, 95, "改善", "改善低密")
    ];
    setSnapshot(snap);

    const gaiShan = getCommunityScatterByAreaCohort("改善");
    expect(gaiShan).toHaveLength(2);

    const gzSmall = getCommunityScatterByAreaCohort("小户型(<60)", 1);
    expect(gzSmall).toHaveLength(1);
    expect(gzSmall[0]!.communityName).toBe("B");
  });

  it("getCommunityScatterPareto 改善 + 单价 ≤ X → 大面积优先", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 70000, 700, 100, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "番禺区", 56, 40000, 500, 125, "改善", "价值洼地"), // 125 最大
      CS(1, "广州", 3, "C", "海珠区", 57, 50000, 600, 120, "改善", "改善低密"),
      CS(1, "广州", 4, "D", "番禺区", 58, 80000, 800, 100, "改善", "豪宅板块") // 80000 超过 70000 阈值
    ];
    setSnapshot(snap);

    const pareto = getCommunityScatterPareto("改善", 70000, 3);
    expect(pareto).toHaveLength(3); // D 过滤
    expect(pareto[0]!.communityName).toBe("B"); // 125㎡ 最大
    expect(pareto[0]!.medianArea).toBe(125);
  });

  it("getCommunityScatterCrossCityByQuadrant 跨城象限代表", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      // 豪宅板块：广州 2 家 + 深圳 1 家
      CS(1, "广州", 1, "A", "天河区", 55, 70000, 700, 100, "改善", "豪宅板块"),
      CS(1, "广州", 2, "B", "天河区", 56, 80000, 800, 100, "改善", "豪宅板块"), // 广州最高
      CS(2, "深圳", 3, "C", "南山区", 61, 120000, 1142, 94, "改善", "豪宅板块")
    ];
    setSnapshot(snap);

    const cross = getCommunityScatterCrossCityByQuadrant("豪宅板块");
    expect(cross).toHaveLength(2);
    expect(cross[0]!.cityName).toBe("深圳"); // 120000
    expect(cross[1]!.cityName).toBe("广州"); // 80000 (B)
    expect(cross[1]!.communityName).toBe("B");
  });

  it("getCommunityScatterByCityTotalPriceExtremes 千万豪宅 vs 上车盘", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [
      CS(1, "广州", 1, "A", "天河区", 55, 76234, 1000, 130, "改善", "豪宅板块"), // 1000 万
      CS(1, "广州", 2, "B", "天河区", 56, 69946, 800, 110, "改善", "豪宅板块"), // 800 万
      CS(1, "广州", 3, "C", "番禺区", 52, 36730, 200, 60, "小户型(<60)", "价值洼地"), // 200 万
      CS(1, "广州", 4, "D", "番禺区", 53, 34338, 150, 50, "小户型(<60)", "价值洼地")  // 150 万
    ];
    setSnapshot(snap);

    const { top, bottom } = getCommunityScatterByCityTotalPriceExtremes(1, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.communityName).toBe("A"); // 1000 万最高
    expect(top[0]!.medianTotalPrice10w).toBe(1000);
    expect(bottom).toHaveLength(2);
    expect(bottom[0]!.communityName).toBe("D"); // 150 万最低
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.communityScatter = [];
    setSnapshot(snap);

    expect(summarizeCommunityScatterByCity()).toEqual([]);
    expect(summarizeCommunityScatterByCityQuadrant()).toEqual([]);
    expect(summarizeCommunityScatterByCityAreaCohort()).toEqual([]);
    expect(getCommunityScatterByQuadrant("豪宅板块")).toEqual([]);
    expect(getCommunityScatterByAreaCohort("改善")).toEqual([]);
    expect(getCommunityScatterPareto("改善", 70000, 5)).toEqual([]);
    expect(getCommunityScatterCrossCityByQuadrant("豪宅板块")).toEqual([]);
    expect(getCommunityScatterByCityTotalPriceExtremes(1, 5)).toEqual({
      top: [],
      bottom: []
    });
  });
});