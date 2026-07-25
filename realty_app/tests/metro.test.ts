import { describe, expect, it } from "vitest";
import { setSnapshot } from "../src/local/store";
import {
  summarizeMetroWalkAccessibility,
  getMetroWalkRankingTopN,
  getMetroWalkRankingByCityTopN
} from "../src/local/metro";

function row(
  communityId: number,
  cityId: number,
  communityName: string,
  walkMinutes: number
) {
  return {
    communityId,
    cityId,
    communityName,
    stationName: `${communityName}-站`,
    stationLat: 22.5,
    stationLng: 113.9,
    straightM: 200,
    walkDistanceM: 200,
    walkMinutes,
    source: "ESTIMATED" as const
  };
}

// setSnapshot 内部 rebuildIndexes 需要 cities / communities / listings / schools 数组存在；
// 测试仅关心 metroWalk 派生，给空数组即可。
function emptySnapshot<T>(metroWalks: T[]) {
  return {
    cities: [],
    communities: [],
    listings: [],
    schools: [],
    metroWalks
  };
}

describe("v0.92.0 metro walk accessibility", () => {
  it("summarizeMetroWalkAccessibility 按 pct5Min 降序", () => {
    setSnapshot(
      emptySnapshot([
        row(1, 1, "GZ-A", 3),
        row(2, 1, "GZ-B", 8),
        row(3, 2, "SZ-X", 1),
        row(4, 2, "SZ-Y", 4),
        row(5, 2, "SZ-Z", 12)
      ]) as any
    );
    const summary = summarizeMetroWalkAccessibility();
    expect(summary.length).toBe(2);
    // cityId=2 深圳：3 个里 2 个 ≤5 = 0.667；cityId=1 广州：2 个里 1 个 ≤5 = 0.5
    expect(summary[0].cityId).toBe(2);
    expect(summary[0].pct5Min).toBeCloseTo(2 / 3, 3);
    expect(summary[0].within5Min).toBe(2);
    // SZ: X=1, Y=4 (≤10) ; Z=12 (>10) -> within10Min=2
    expect(summary[0].within10Min).toBe(2);
    expect(summary[1].cityId).toBe(1);
    expect(summary[1].pct5Min).toBeCloseTo(0.5, 3);
    expect(summary[1].within5Min).toBe(1);
    expect(summary[1].within10Min).toBe(2);
  });

  it("getMetroWalkRankingTopN: 全市场排序，按 walkMinutes 升序", () => {
    setSnapshot(
      emptySnapshot([
        row(1, 2, "A", 6),
        row(2, 1, "B", 2),
        row(3, 2, "C", 9),
        row(4, 1, "D", 4),
        row(5, 2, "E", 1)
      ]) as any
    );
    const top = getMetroWalkRankingTopN(3);
    expect(top.map((x) => x.communityName)).toEqual(["E", "B", "D"]);
    expect(top[0].rank).toBe(1);
    expect(top[2].rank).toBe(3);
  });

  it("getMetroWalkRankingByCityTopN: 单城市过滤 + 升序", () => {
    setSnapshot(
      emptySnapshot([
        row(1, 2, "SZ-A", 5),
        row(2, 1, "GZ-A", 3),
        row(3, 2, "SZ-B", 2),
        row(4, 1, "GZ-B", 9),
        row(5, 2, "SZ-C", 7)
      ]) as any
    );
    const sz = getMetroWalkRankingByCityTopN(2, 3);
    expect(sz.map((x) => x.communityName)).toEqual(["SZ-B", "SZ-A", "SZ-C"]);
    expect(sz.every((x) => x.cityId === 2)).toBe(true);
  });

  it("空快照：返回空数组，不抛异常", () => {
    setSnapshot(emptySnapshot([]) as any);
    expect(summarizeMetroWalkAccessibility()).toEqual([]);
    expect(getMetroWalkRankingTopN(5)).toEqual([]);
    expect(getMetroWalkRankingByCityTopN(1, 5)).toEqual([]);
  });
});
