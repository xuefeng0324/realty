import { describe, expect, it } from "vitest";
import {
  getWangqianWeeklyByCityCategoryTrend,
  getWangqianWeeklyRecentSpikes,
  getWangqianWeeklyVolatility,
  getWangqianWeeklyWoWChange,
  summarizeWangqianWeeklyByDistrict
} from "../src/local/wangqianTrendRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalWangqianDistrictWeekly
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

function W(
  city: string,
  district: string,
  category: "新房" | "二手" | "其他",
  weekEnd: string,
  totalUnits: number,
  days = 7,
  avgDailyUnits = totalUnits / days,
  totalAreaSqm = 0,
  avgDailyAreaSqm = 0
): LocalWangqianDistrictWeekly {
  return {
    city,
    district,
    category,
    weekEnd,
    days,
    totalUnits,
    totalAreaSqm,
    avgDailyUnits,
    avgDailyAreaSqm
  };
}

describe("wangqianTrendRanking", () => {
  it("summarizeWangqianWeeklyByDistrict 聚合 + 最新周", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      W("广州", "南沙区", "新房", "2026-06-28", 79, 3),
      W("广州", "南沙区", "新房", "2026-07-05", 65, 5),
      W("广州", "天河区", "新房", "2026-07-05", 56, 5)
    ];
    setSnapshot(snap);

    const sum = summarizeWangqianWeeklyByDistrict();
    expect(sum).toHaveLength(2);

    const ns = sum.find((s) => s.district === "南沙区")!;
    expect(ns.weekCount).toBe(2);
    expect(ns.totalUnits).toBe(144);
    expect(ns.latestUnits).toBe(65);
    expect(ns.latestWeekEnd).toBe("2026-07-05");
  });

  it("getWangqianWeeklyWoWChange 最近 vs 前一周 pct", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      W("广州", "南沙区", "新房", "2026-06-28", 100),
      W("广州", "南沙区", "新房", "2026-07-05", 150), // +50%
      W("广州", "天河区", "新房", "2026-06-28", 200),
      W("广州", "天河区", "新房", "2026-07-05", 100)  // -50%
    ];
    setSnapshot(snap);

    const wow = getWangqianWeeklyWoWChange();
    expect(wow).toHaveLength(2);
    const ns = wow.find((x) => x.district === "南沙区")!;
    expect(ns.changePct).toBeCloseTo(50, 5);
    expect(ns.prevUnits).toBe(100);
    expect(ns.latestUnits).toBe(150);
    const th = wow.find((x) => x.district === "天河区")!;
    expect(th.changePct).toBeCloseTo(-50, 5);
  });

  it("getWangqianWeeklyWoWChange prev=0 且 latest>0 时返回 Infinity", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      W("广州", "增城区", "新房", "2026-06-28", 0),
      W("广州", "增城区", "新房", "2026-07-05", 10)
    ];
    setSnapshot(snap);

    const wow = getWangqianWeeklyWoWChange();
    expect(wow).toHaveLength(1);
    expect(wow[0]!.changePct).toBe(Number.POSITIVE_INFINITY);
  });

  it("getWangqianWeeklyVolatility CV 计算", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      // 稳定：[100, 100, 100, 100] CV = 0
      W("广州", "南沙区", "新房", "2026-06-15", 100),
      W("广州", "南沙区", "新房", "2026-06-22", 100),
      W("广州", "南沙区", "新房", "2026-06-29", 100),
      W("广州", "南沙区", "新房", "2026-07-06", 100),
      // 不稳定：[100, 200, 50, 150]
      W("广州", "天河区", "新房", "2026-06-15", 100),
      W("广州", "天河区", "新房", "2026-06-22", 200),
      W("广州", "天河区", "新房", "2026-06-29", 50),
      W("广州", "天河区", "新房", "2026-07-06", 150)
    ];
    setSnapshot(snap);

    const vol = getWangqianWeeklyVolatility();
    expect(vol).toHaveLength(2);
    const stable = vol.find((v) => v.district === "南沙区")!;
    expect(stable.cv).toBeCloseTo(0, 5);
    expect(stable.mean).toBe(100);
    expect(stable.stdDev).toBeCloseTo(0, 5);

    const unstable = vol.find((v) => v.district === "天河区")!;
    expect(unstable.mean).toBe(125);
    expect(unstable.stdDev).toBeGreaterThan(0);
    expect(unstable.cv).toBeGreaterThan(0);
  });

  it("getWangqianWeeklyRecentSpikes 检测最新周倍增", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      // 前 4 周平均 50，最新周 100 → 2x → 应该被检出
      W("广州", "南沙区", "新房", "2026-06-08", 40),
      W("广州", "南沙区", "新房", "2026-06-15", 50),
      W("广州", "南沙区", "新房", "2026-06-22", 60),
      W("广州", "南沙区", "新房", "2026-06-29", 50),
      W("广州", "南沙区", "新房", "2026-07-06", 100),
      // 前 4 周平均 80，最新周 80 → 1x → 不应被检出
      W("广州", "天河区", "新房", "2026-06-08", 80),
      W("广州", "天河区", "新房", "2026-06-15", 80),
      W("广州", "天河区", "新房", "2026-06-22", 80),
      W("广州", "天河区", "新房", "2026-06-29", 80),
      W("广州", "天河区", "新房", "2026-07-06", 80)
    ];
    setSnapshot(snap);

    const spikes = getWangqianWeeklyRecentSpikes(4, 1.5);
    expect(spikes).toHaveLength(1);
    expect(spikes[0]!.district).toBe("南沙区");
    expect(spikes[0]!.multiplier).toBeCloseTo(2, 5);
    expect(spikes[0]!.latestUnits).toBe(100);
    expect(spikes[0]!.weekEnd).toBe("2026-07-06");
  });

  it("getWangqianWeeklyByCityCategoryTrend 整市 trend", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      // 广州新房：天河区 + 越秀区
      W("广州", "天河区", "新房", "2026-06-08", 50),
      W("广州", "天河区", "新房", "2026-06-15", 50),
      W("广州", "天河区", "新房", "2026-06-22", 50),
      W("广州", "天河区", "新房", "2026-06-29", 50),
      W("广州", "天河区", "新房", "2026-07-06", 200), // 4 倍
      W("广州", "越秀区", "新房", "2026-06-08", 30),
      W("广州", "越秀区", "新房", "2026-06-15", 30),
      W("广州", "越秀区", "新房", "2026-06-22", 30),
      W("广州", "越秀区", "新房", "2026-06-29", 30),
      W("广州", "越秀区", "新房", "2026-07-06", 100)  // 整市最新 300
    ];
    setSnapshot(snap);

    const trend = getWangqianWeeklyByCityCategoryTrend(4);
    expect(trend).toHaveLength(1);
    expect(trend[0]!.city).toBe("广州");
    expect(trend[0]!.category).toBe("新房");
    // 前 4 周均 = (50+50+50+50 + 30+30+30+30) / 2 = 80；
    // 最新周 = 200+100 = 300 → change = (300-80)/80*100 = 275%
    expect(trend[0]!.recentAvg).toBeCloseTo(80, 5);
    expect(trend[0]!.latestUnits).toBe(300);
    expect(trend[0]!.changePct).toBeCloseTo(275, 5);
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [];
    setSnapshot(snap);

    expect(summarizeWangqianWeeklyByDistrict()).toEqual([]);
    expect(getWangqianWeeklyWoWChange()).toEqual([]);
    expect(getWangqianWeeklyVolatility()).toEqual([]);
    expect(getWangqianWeeklyRecentSpikes(4, 1.5)).toEqual([]);
    expect(getWangqianWeeklyByCityCategoryTrend(4)).toEqual([]);
  });

  it("周数不足时不计算（避免错算）", () => {
    const snap = emptySnapshot();
    snap.wangqianDistrictWeekly = [
      W("广州", "南沙区", "新房", "2026-07-05", 100) // 仅 1 周
    ];
    setSnapshot(snap);

    expect(getWangqianWeeklyWoWChange()).toEqual([]);
    expect(getWangqianWeeklyVolatility()).toEqual([]);
    expect(getWangqianWeeklyRecentSpikes(4, 1.5)).toEqual([]);
    expect(getWangqianWeeklyByCityCategoryTrend(4)).toEqual([]);
  });
});