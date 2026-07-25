import { describe, expect, it } from "vitest";
import {
  getDistrict12WeekChangeRank,
  getDistrictPriceSummary,
  getDistrictRecentMomentumRank,
  summarizeChangeDistribution
} from "../src/local/districtDrift";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalDistrictTrend
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
    climate: {
      cities: [],
      globalIndex: { source: "test", updatedAt: "1970-01-01" }
    },
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
    listingFreshness: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function mkTrend(
  weekEnd: string,
  price: number,
  cityId = 1,
  district = "天河区"
): LocalDistrictTrend {
  return {
    cityId,
    districtName: district,
    weekEnd,
    listingCount: 3,
    avgUnitPrice: price,
    medianUnitPrice: price,
    minUnitPrice: price,
    maxUnitPrice: price
  };
}

describe("districtDrift", () => {
  it("getDistrict12WeekChangeRank 派生正确涨跌比例", () => {
    const snap = emptySnapshot();
    const trends: LocalDistrictTrend[] = [];
    // 13 周：基线 70000，末周 77000 → change ≈ 0.10
    const basePrices = [70000, 70500, 71000, 71500, 72000, 72500, 73000, 73500, 74000, 74500, 75000, 75500, 77000];
    for (let i = 0; i < basePrices.length; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      trends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          basePrices[i] as number,
          1,
          "天河区"
        )
      );
    }
    // 另一区：基线相同 70000，末周设为 63000（共 -10%）
    const haizhuPrices = [
      70000, 70200, 70400, 70600, 70800, 70500, 69700, 69000, 68000, 67000,
      66000, 65000, 63000
    ];
    for (let i = 0; i < haizhuPrices.length; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      trends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          haizhuPrices[i]!,
          1,
          "海珠区"
        )
      );
    }
    snap.districtTrends = trends;
    setSnapshot(snap);

    const ranked = getDistrict12WeekChangeRank(1);
    expect(ranked).toHaveLength(2);
    // 天河区在天 (涨幅)，海珠区在后 (跌幅)
    expect(ranked[0]!.districtName).toBe("天河区");
    expect(ranked[0]!.change).toBeGreaterThan(0.09);
    expect(ranked[0]!.change).toBeLessThan(0.11);
    expect(ranked[0]!.basePrice).toBe(70000);
    expect(ranked[0]!.latestPrice).toBe(77000);
    expect(ranked[0]!.weeksAvailable).toBe(13);

    expect(ranked[1]!.districtName).toBe("海珠区");
    expect(ranked[1]!.change).toBeLessThan(-0.09);
  });

  it("strictBase=false 时数据不足 12 周仍用首尾做比较，并给出 weeksAvailable", () => {
    const snap = emptySnapshot();
    const trends: LocalDistrictTrend[] = [
      mkTrend("2026-01-04", 50000, 1, "番禺区"),
      mkTrend("2026-01-11", 52000, 1, "番禺区"),
      mkTrend("2026-01-18", 55000, 1, "番禺区")
    ];
    snap.districtTrends = trends;
    setSnapshot(snap);

    // 默认 strictBase=true 时，< 13 周整条跳过
    const strictRan = getDistrict12WeekChangeRank(1);
    expect(strictRan).toHaveLength(0);

    // strictBase=false 时兼容旧行为
    const looseRan = getDistrict12WeekChangeRank(1, { strictBase: false, minWeeks: 2 });
    expect(looseRan).toHaveLength(1);
    expect(looseRan[0]!.weeksAvailable).toBe(3);
    // change = (55000 - 50000) / 50000 = 0.1
    expect(looseRan[0]!.change).toBeCloseTo(0.1, 5);
  });

  it("支持按 cityId 过滤", () => {
    const snap = emptySnapshot();
    snap.districtTrends = [
      mkTrend("2026-01-04", 60000, 1, "天河区"),
      mkTrend("2026-01-11", 65000, 1, "天河区"),
      mkTrend("2026-01-04", 30000, 2, "南山区"),
      mkTrend("2026-01-11", 32000, 2, "南山区")
    ];
    setSnapshot(snap);

    const gz = getDistrict12WeekChangeRank(1, { strictBase: false });
    expect(gz).toHaveLength(1);
    expect(gz[0]!.cityId).toBe(1);
    const sz = getDistrict12WeekChangeRank(2, { strictBase: false });
    expect(sz).toHaveLength(1);
    expect(sz[0]!.cityId).toBe(2);
  });

  it("momentum 按 (后4周均值 vs 前4周均值) 排序，null 沉底", () => {
    const snap = emptySnapshot();
    const trends: LocalDistrictTrend[] = [];
    // 12 周：近期 4 周 vs 前 4 周
    const prices = [60000, 60500, 61000, 61500, 62000, 62500, 63000, 63500, 68000, 69000, 70000, 71000];
    for (let i = 0; i < prices.length; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      trends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          prices[i]!,
          1,
          "加速区"
        )
      );
    }
    // 一组数据不足 8 周 → null 沉底
    trends.push(mkTrend("2026-01-04", 50000, 1, "不足区"));
    trends.push(mkTrend("2026-01-11", 52000, 1, "不足区"));
    snap.districtTrends = trends;
    setSnapshot(snap);

    const ranked = getDistrictRecentMomentumRank(1);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.districtName).toBe("加速区");
    expect(ranked[0]!.momentum).not.toBeNull();
    expect(ranked[0]!.momentum!).toBeGreaterThan(0); // 加速
    expect(ranked[0]!.recentSeries).toHaveLength(4);
    expect(ranked[0]!.recentSeries[3]!.price).toBe(71000);
    expect(ranked[1]!.districtName).toBe("不足区");
    expect(ranked[1]!.momentum).toBeNull();
  });

  it("getDistrictPriceSummary 返回窗口最高/最低与周数", () => {
    const snap = emptySnapshot();
    snap.districtTrends = [];
    const prices = [60000, 65000, 62000, 67000, 63000];
    for (let i = 0; i < prices.length; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      snap.districtTrends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          prices[i]!,
          1,
          "窗口区"
        )
      );
    }
    setSnapshot(snap);

    const sum = getDistrictPriceSummary(1, "窗口区", 12);
    expect(sum.weeks).toBe(5);
    expect(sum.minPrice).toBe(60000);
    expect(sum.maxPrice).toBe(67000);
    expect(sum.latest).not.toBeNull();
    expect(sum.latest!.avgUnitPrice).toBe(63000);
  });

  it("summarizeChangeDistribution 区分宽松 vs 严格两个口径", () => {
    const snap = emptySnapshot();
    snap.districtTrends = [];
    // A 区 13 周（合格），B 区 8 周（宽松进，严格不进），C 区 4 周（都进）
    for (let i = 0; i < 13; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      snap.districtTrends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          60000 + i * 100,  // 持续上涨
          1,
          "A区"
        )
      );
    }
    for (let i = 0; i < 8; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      snap.districtTrends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          50000 - i * 100,  // 持续下跌
          1,
          "B区"
        )
      );
    }
    for (let i = 0; i < 4; i++) {
      const d = new Date(2026, 0, 4 + i * 7);
      snap.districtTrends.push(
        mkTrend(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          40000 - i * 200,
          1,
          "C区"
        )
      );
    }
    setSnapshot(snap);

    const dist = summarizeChangeDistribution(1);
    // 宽松：A 涨(0.013) + B 跌(0.0188) + C 跌(0.02)
    //      注意 n<10 时 old baseIdx 也是 0，所以全用首尾做对比
    expect(dist.total).toBe(3);  // 全部进
    // A = (61300-60000)/60000 ≈ +0.0217
    // B = (49200-50000)/50000 = -0.016
    // C = (39400-40000)/40000 = -0.015
    expect(dist.up).toBe(1);  // A
    expect(dist.down).toBe(2);  // B + C
    // 严格：只有 A 13 周
    expect(dist.strictTotal).toBe(1);
    expect(dist.strictUp).toBe(1);
    expect(dist.strictDown).toBe(0);
  });
});
