import { describe, expect, it } from "vitest";
import {
  getStats70CityOver12MonthChange,
  getStats70CityTrendDirection,
  getStats70CrossCityByCityCount,
  getStats70CrossCityByMonthSpread,
  getStats70CurrentCityNationalRank,
  getStats70LatestByCity,
  getStats70LatestMonth,
  getStats70MonthOptions,
  getStats70TopByTypeByMonth
} from "../src/local/stats70TrendAnalysis";
import { setSnapshot, setStats70, getStats70 } from "../src/local/store";
import type { DataSnapshot, LocalStats70Row } from "../src/local/types";

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
    poiCommercials: [],
    adminDistricts: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function R(
  date: string,
  city: string,
  fixedBase: "同比" | "环比",
  newIdx: number | null,
  secondIdx: number | null
): LocalStats70Row {
  return { date, city, fixed_base: fixedBase, new_idx: newIdx, second_idx: secondIdx };
}

describe("stats70TrendAnalysis", () => {
  it("getStats70MonthOptions 升序 + getStats70LatestMonth 最新", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/6/1", "广州", "同比", 102.5, 100.3),
      R("2025/7/1", "广州", "同比", 102.8, 100.5),
      R("2025/8/1", "广州", "同比", 103.0, 100.8)
    ]);
    expect(getStats70MonthOptions()).toEqual([
      "2025/6/1",
      "2025/7/1",
      "2025/8/1"
    ]);
    expect(getStats70LatestMonth()).toBe("2025/8/1");
  });

  it("getStats70LatestByCity 单 city 4 指数", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/7/1", "广州", "同比", 102.5, 100.3),
      R("2025/7/1", "广州", "环比", 100.2, 99.8),
      R("2025/8/1", "广州", "同比", 102.8, 100.5),
      R("2025/8/1", "广州", "环比", 100.3, 99.9)
    ]);
    const r = getStats70LatestByCity("广州");
    expect(r).not.toBeNull();
    expect(r!.date).toBe("2025/8/1");
    expect(r!.newYoY).toBe(102.8);
    expect(r!.newMoM).toBe(100.3);
    expect(r!.secondYoY).toBe(100.5);
    expect(r!.secondMoM).toBe(99.9);
  });

  it("getStats70TopByTypeByMonth 涨 Top + 跌 Top", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/8/1", "广州", "同比", 105.0, 100.3), // 涨第 1
      R("2025/8/1", "深圳", "同比", 108.5, 102.0), // 涨第 0
      R("2025/8/1", "珠海", "同比", 95.0, 96.0), // 跌
      R("2025/8/1", "北京", "同比", 102.0, 101.0)
    ]);
    const topUp = getStats70TopByTypeByMonth("2025/8/1", "同比", "new_idx", 2);
    expect(topUp).toHaveLength(2);
    expect(topUp[0]!.city).toBe("深圳"); // 108.5 最高
    expect(topUp[1]!.city).toBe("广州"); // 105.0 第二
    expect(topUp[0]!.value).toBe(108.5);

    const topDown = getStats70TopByTypeByMonth(
      "2025/8/1",
      "同比",
      "new_idx",
      -2
    );
    expect(topDown[0]!.city).toBe("珠海"); // 95.0 最低
  });

  it("getStats70CurrentCityNationalRank 排位 + topPct", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/8/1", "广州", "同比", 105.0, null),
      R("2025/8/1", "深圳", "同比", 108.0, null),
      R("2025/8/1", "珠海", "同比", 102.0, null),
      R("2025/8/1", "北京", "同比", 100.0, null),
      R("2025/8/1", "上海", "同比", 95.0, null)
    ]);
    const sh = getStats70CurrentCityNationalRank("上海");
    expect(sh).not.toBeNull();
    expect(sh!.rank).toBe(5); // 最低
    expect(sh!.totalCities).toBe(5);
    expect(sh!.topPct).toBe(100); // 100%

    const sz = getStats70CurrentCityNationalRank("深圳");
    expect(sz!.rank).toBe(1); // 最高
    expect(sz!.topPct).toBe(20); // 1/5 = 20%
  });

  it("getStats70CityOver12MonthChange 近 12 月轨迹（最多 12 点）", () => {
    setSnapshot(emptySnapshot());
    // 生成 15 个月跨年（2024/01 .. 2025/03），近 12 月应为 2024/04 .. 2025/03
    const months: string[] = [];
    for (let i = 0; i < 15; i++) {
      const total = i; // 0-based offset from 2024/01
      const y = 2024 + Math.floor(total / 12);
      const m = ((total % 12) + 1).toString().padStart(2, "0");
      months.push(`${y}/${m}/1`);
    }
    setStats70(
      months.flatMap((m, i) => [
        R(m, "广州", "同比", 100 + i * 0.1, 100 + i * 0.05),
        R(m, "广州", "环比", 100.2, 99.9)
      ])
    );
    const series = getStats70CityOver12MonthChange("广州");
    expect(series).toHaveLength(12); // 最近 12 月
    expect(series[0]!.date).toBe("2024/04/1"); // 第 4 月
    expect(series[11]!.date).toBe("2025/03/1"); // 第 15 月
    expect(series[11]!.newYoY).toBeCloseTo(101.4, 1);
  });

  it("getStats70CrossCityByMonthSpread 4 指数最值差", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/8/1", "广州", "同比", 108.0, 99.5),
      R("2025/8/1", "深圳", "同比", 95.0, 102.0),
      R("2025/8/1", "广州", "环比", 101.0, 100.5),
      R("2025/8/1", "深圳", "环比", 99.5, 99.0)
    ]);
    const spread = getStats70CrossCityByMonthSpread("2025/8/1");
    expect(spread).toHaveLength(4);
    const yoyNew = spread.find(
      (x) => x.fixedBase === "同比" && x.indexType === "new_idx"
    )!;
    expect(yoyNew.min).toBe(95.0);
    expect(yoyNew.max).toBe(108.0);
    expect(yoyNew.spread).toBe(13);
  });

  it("getStats70CityTrendDirection 涨/跌/平稳 三种", () => {
    setSnapshot(emptySnapshot());
    // 涨：新指数连续升
    setStats70([
      R("2025/6/1", "广州", "同比", 100.0, null),
      R("2025/7/1", "广州", "同比", 101.0, null),
      R("2025/8/1", "广州", "同比", 102.0, null)
    ]);
    expect(getStats70CityTrendDirection("广州")!.direction).toBe("上涨");
    expect(getStats70CityTrendDirection("广州")!.avgChangePp).toBe(1.0);

    // 跌
    setStats70([
      R("2025/6/1", "深圳", "同比", 102.0, null),
      R("2025/7/1", "深圳", "同比", 101.0, null),
      R("2025/8/1", "深圳", "同比", 100.0, null)
    ]);
    expect(getStats70CityTrendDirection("深圳")!.direction).toBe("下跌");

    // 平稳
    setStats70([
      R("2025/6/1", "珠海", "同比", 100.2, null),
      R("2025/7/1", "珠海", "同比", 100.3, null),
      R("2025/8/1", "珠海", "同比", 100.2, null)
    ]);
    expect(getStats70CityTrendDirection("珠海")!.direction).toBe("平稳");

    // 数据不足
    setStats70([R("2025/8/1", "北京", "同比", 100.0, null)]);
    expect(getStats70CityTrendDirection("北京")!.direction).toBe("数据不足");
  });

  it("getStats70CrossCityByCityCount 涨/跌/平城市数", () => {
    setSnapshot(emptySnapshot());
    setStats70([
      R("2025/8/1", "广州", "同比", 105.0, 98.5), // new 涨 / second 跌
      R("2025/8/1", "深圳", "同比", 102.0, 101.0), // new 涨 / second 涨
      R("2025/8/1", "珠海", "同比", 99.0, 100.0), // new 跌 / second 平
      R("2025/8/1", "北京", "同比", 100.0, 100.0), // 双平
      R("2025/8/1", "上海", "同比", 96.0, 97.0) // 双跌
    ]);
    const counts = getStats70CrossCityByCityCount("2025/8/1");
    const newYoy = counts.find(
      (x) => x.fixedBase === "同比" && x.indexType === "new_idx"
    )!;
    expect(newYoy.total).toBe(5);
    expect(newYoy.upCount).toBe(2); // 广州 + 深圳
    expect(newYoy.downCount).toBe(2); // 珠海 + 上海
    expect(newYoy.flatCount).toBe(1); // 北京
  });

  it("空 snapshot 安全降级", () => {
    setSnapshot(emptySnapshot());
    setStats70([]);

    expect(getStats70MonthOptions()).toEqual([]);
    expect(getStats70LatestMonth()).toBeNull();
    expect(getStats70LatestByCity("广州")).toBeNull();
    expect(getStats70TopByTypeByMonth("2025/8/1", "同比", "new_idx", 5)).toEqual(
      []
    );
    expect(getStats70CurrentCityNationalRank("广州")).toBeNull();
    expect(getStats70CityOver12MonthChange("广州")).toEqual([]);
    expect(getStats70CrossCityByMonthSpread("2025/8/1")).toEqual([]);
    const trend = getStats70CityTrendDirection("广州");
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe("数据不足");
    expect(getStats70CrossCityByCityCount("2025/8/1")).toEqual([]);
  });
});