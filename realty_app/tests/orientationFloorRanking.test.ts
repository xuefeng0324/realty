import { describe, expect, it } from "vitest";
import {
  getOrientationFloorBestWorstByCity,
  getOrientationFloorByCityFloorBucket,
  getOrientationFloorByCityOrientation,
  getOrientationFloorByOrientationLeaderboard,
  getOrientationFloorCrossCityByPair,
  summarizeOrientationFloorByCity
} from "../src/local/orientationFloorRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalOrientationFloor
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

function OF(
  cityId: number,
  cityName: string,
  orientation: string,
  floorBucket: string,
  count: number,
  share: number,
  medianUnitPrice: number,
  premiumPct: number
): LocalOrientationFloor {
  return {
    cityId,
    cityName,
    orientation,
    floorBucket,
    count,
    share,
    medianUnitPrice,
    premiumPct
  };
}

describe("orientationFloorRanking", () => {
  it("summarizeOrientationFloorByCity 聚合 + best/worst", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      // 广州：4 朝向 × 4 楼层 = 16 行（简化用 4 行）
      OF(1, "广州", "东南", "顶层", 35, 0.08, 62032, 10.2), // best
      OF(1, "广州", "南北通透", "中楼层", 22, 0.05, 57030, 1.3),
      OF(1, "广州", "南", "高楼层", 26, 0.06, 51146, -9.2), // worst
      OF(1, "广州", "南", "低楼层", 12, 0.03, 54860, -2.6),
      // 深圳：平均更高
      OF(2, "深圳", "南", "中楼层", 50, 0.1, 90000, 15),
      OF(2, "深圳", "南", "顶层", 30, 0.06, 85000, 10)
    ];
    setSnapshot(snap);

    const sum = summarizeOrientationFloorByCity();
    expect(sum).toHaveLength(2);
    // 按 avgPremiumPct 倒序
    expect(sum[0]!.cityId).toBe(2); // (15+10)/2 = 12.5
    expect(sum[0]!.avgPremiumPct).toBeCloseTo(12.5, 5);
    expect(sum[0]!.best?.orientation).toBe("南");
    expect(sum[1]!.cityId).toBe(1); // (10.2+1.3-9.2-2.6)/4 = -0.075
    expect(sum[1]!.avgPremiumPct).toBeCloseTo(-0.075, 5);
    expect(sum[1]!.best?.orientation).toBe("东南");
    expect(sum[1]!.worst?.orientation).toBe("南");
  });

  it("getOrientationFloorByCityOrientation 单朝向 4 楼层", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      OF(1, "广州", "南", "中楼层", 37, 0.08, 53264, -5.4),
      OF(1, "广州", "南", "低楼层", 12, 0.03, 54860, -2.6),
      OF(1, "广州", "南", "顶层", 28, 0.06, 55646, -1.2),
      OF(1, "广州", "南", "高楼层", 26, 0.06, 51146, -9.2),
      OF(1, "广州", "东南", "顶层", 35, 0.08, 62032, 10.2)
    ];
    setSnapshot(snap);

    const arr = getOrientationFloorByCityOrientation(1, "南");
    expect(arr).toHaveLength(4);
    expect(arr[0]!.floorBucket).toBe("顶层"); // -1.2 最高（最不亏）
    expect(arr[3]!.floorBucket).toBe("高楼层"); // -9.2 最低
  });

  it("getOrientationFloorByCityFloorBucket 单楼层 4 朝向", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      OF(1, "广州", "东南", "顶层", 35, 0.08, 62032, 10.2),
      OF(1, "广州", "南北通透", "顶层", 24, 0.06, 56782, 0.9),
      OF(1, "广州", "南", "顶层", 28, 0.06, 55646, -1.2),
      OF(1, "广州", "西", "顶层", 30, 0.07, 54000, -4)
    ];
    setSnapshot(snap);

    const arr = getOrientationFloorByCityFloorBucket(1, "顶层");
    expect(arr).toHaveLength(4);
    expect(arr[0]!.orientation).toBe("东南"); // 10.2
    expect(arr[3]!.orientation).toBe("西"); // -4
  });

  it("getOrientationFloorCrossCityByPair 跨城同 (orient, floor) 组合对比", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      OF(1, "广州", "南北通透", "顶层", 24, 0.06, 56782, 0.9),
      OF(2, "深圳", "南北通透", "顶层", 20, 0.05, 95000, 18),
      OF(3, "珠海", "南北通透", "顶层", 10, 0.04, 32000, -5)
    ];
    setSnapshot(snap);

    const cross = getOrientationFloorCrossCityByPair("南北通透", "顶层");
    expect(cross).toHaveLength(3);
    expect(cross[0]!.cityName).toBe("深圳"); // 18%
    expect(cross[1]!.cityName).toBe("广州"); // 0.9%
    expect(cross[2]!.cityName).toBe("珠海"); // -5%
  });

  it("getOrientationFloorBestWorstByCity 每城 top/bottom N", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      // 广州
      OF(1, "广州", "东南", "顶层", 35, 0.08, 62032, 10.2),
      OF(1, "广州", "东南", "中楼层", 30, 0.07, 59238, 5.2),
      OF(1, "广州", "南", "高楼层", 26, 0.06, 51146, -9.2),
      OF(1, "广州", "南", "低楼层", 12, 0.03, 54860, -2.6),
      // 深圳
      OF(2, "深圳", "南", "中楼层", 50, 0.1, 90000, 15),
      OF(2, "深圳", "东南", "顶层", 40, 0.08, 95000, 18),
      OF(2, "深圳", "南北通透", "高楼层", 30, 0.06, 80000, -2),
      OF(2, "深圳", "西", "顶层", 20, 0.04, 75000, -8)
    ];
    setSnapshot(snap);

    const { best, worst } = getOrientationFloorBestWorstByCity(2);
    expect(best).toHaveLength(4); // 2 城 × 2
    expect(best[0]!.cityName).toBe("深圳"); // 18% 顶层东南
    expect(best[0]!.premiumPct).toBeCloseTo(18, 5);

    expect(worst).toHaveLength(4);
    expect(worst[0]!.cityName).toBe("广州"); // -9.2% 高楼层南
    expect(worst[0]!.premiumPct).toBeCloseTo(-9.2, 5);
  });

  it("getOrientationFloorByOrientationLeaderboard 单朝向跨城价格榜", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [
      OF(1, "广州", "南", "中楼层", 37, 0.08, 53264, -5.4),
      OF(2, "深圳", "南", "中楼层", 50, 0.1, 90000, 15),
      OF(3, "珠海", "南", "中楼层", 30, 0.06, 30000, -10),
      OF(2, "深圳", "南", "顶层", 30, 0.06, 85000, 10)
    ];
    setSnapshot(snap);

    const lb = getOrientationFloorByOrientationLeaderboard("南", 5);
    expect(lb).toHaveLength(4);
    expect(lb[0]!.cityName).toBe("深圳"); // 90000
    expect(lb[0]!.floorBucket).toBe("中楼层");
    expect(lb[3]!.cityName).toBe("珠海"); // 30000
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.orientationFloor = [];
    setSnapshot(snap);

    expect(summarizeOrientationFloorByCity()).toEqual([]);
    expect(getOrientationFloorByCityOrientation(1, "南")).toEqual([]);
    expect(getOrientationFloorByCityFloorBucket(1, "顶层")).toEqual([]);
    expect(getOrientationFloorCrossCityByPair("南", "顶层")).toEqual([]);
    expect(getOrientationFloorBestWorstByCity(3)).toEqual({ best: [], worst: [] });
    expect(getOrientationFloorByOrientationLeaderboard("南", 5)).toEqual([]);
  });
});