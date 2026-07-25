import { describe, expect, it } from "vitest";
import {
  detectLprCutCycles,
  getLprAtMonth,
  getLprByYear,
  getLprDelta,
  getLprDownwardCumulative,
  getLprLatest,
  getLprLongestFlatStreak,
  getLprMonthlyAverage,
  getLprRange,
  summarizeLprByYear,
  summarizeLprCurrentVsYearAgo,
  summarizeLprSpread
} from "../src/local/lprHistoryAnalysis";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalLprRow } from "../src/local/types";

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

function L(
  month: string,
  lpr1y: number,
  lpr5y: number,
  mortgageFirst: number,
  mortgageSecond: number
): LocalLprRow {
  return { month, lpr1y, lpr5y, mortgageFirst, mortgageSecond, source: "test" };
}

describe("lprHistoryAnalysis", () => {
  it("getLprLatest 返回最新月", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      L("2025-06", 3.0, 3.5, 3.2, 3.85),
      L("2026-06", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    expect(getLprLatest()!.month).toBe("2026-06");
  });

  it("getLprByYear 单年所有月 + 升序", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2025-03", 3.1, 3.6, 3.3, 3.95),
      L("2025-01", 3.1, 3.6, 3.3, 3.95),
      L("2026-01", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const arr = getLprByYear(2025);
    expect(arr).toHaveLength(2);
    expect(arr[0]!.month).toBe("2025-01");
    expect(arr[1]!.month).toBe("2025-03");
  });

  it("summarizeLprByYear 年聚合（年初/年末/调息次数）", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      // 2024: 4.2 → 3.6（2 次降息：2024-02 和 2024-10）
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      L("2024-02", 3.45, 3.95, 3.65, 4.3), // 降
      L("2024-10", 3.1, 3.6, 3.3, 3.95), // 降
      L("2024-12", 3.1, 3.6, 3.3, 3.95),
      // 2025: 3.6 → 3.5（1 次降息：2025-04）
      L("2025-01", 3.1, 3.6, 3.3, 3.95),
      L("2025-04", 3.0, 3.5, 3.2, 3.85), // 降
      L("2025-12", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);

    const arr = summarizeLprByYear();
    expect(arr).toHaveLength(2);
    const y2024 = arr.find((x) => x.year === 2024)!;
    expect(y2024.startLpr5y).toBe(4.2);
    expect(y2024.endLpr5y).toBe(3.6);
    expect(y2024.changeCount).toBe(2); // 2 月 + 10 月
    expect(y2024.minLpr5y).toBe(3.6);
    expect(y2024.maxLpr5y).toBe(4.2);

    const y2025 = arr.find((x) => x.year === 2025)!;
    expect(y2025.startLpr5y).toBe(3.6);
    expect(y2025.endLpr5y).toBe(3.5);
    expect(y2025.changeCount).toBe(1);
  });

  it("detectLprCutCycles 调息节点 + 累计 bp", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2019-08", 4.25, 4.85, 4.9, 5.2), // 起点 4.85
      L("2019-11", 4.15, 4.8, 4.85, 5.15), // -5bp → 累计 -5
      L("2020-02", 4.05, 4.75, 4.8, 5.1), // -5bp → 累计 -10
      L("2024-10", 3.1, 3.6, 3.3, 3.95), // -35bp → 累计 -125
      L("2025-04", 3.0, 3.5, 3.2, 3.85) // -10bp → 累计 -135
    ];
    setSnapshot(snap);

    const cycles = detectLprCutCycles();
    expect(cycles).toHaveLength(4);
    expect(cycles[0]!.direction).toBe("down");
    expect(cycles[0]!.changeBp).toBe(5);
    expect(cycles[0]!.cumulativeBp).toBe(5);
    expect(cycles[1]!.cumulativeBp).toBe(10);
    expect(cycles[3]!.month).toBe("2025-04");
    expect(cycles[3]!.cumulativeBp).toBe(135);
  });

  it("getLprAtMonth 精确查询", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-10", 3.1, 3.6, 3.3, 3.95),
      L("2025-04", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    expect(getLprAtMonth("2025-04")!.lpr5y).toBe(3.5);
    expect(getLprAtMonth("2026-01")).toBeNull();
  });

  it("getLprDelta 区间累计变动 bp", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      L("2025-06", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const d = getLprDelta("2024-01", "2025-06")!;
    expect(d.lpr5yDeltaBp).toBe(70); // 4.2 - 3.5 = 0.7 = 70bp
    expect(d.lpr1yDeltaBp).toBe(45); // 3.45 - 3.0 = 45bp
    expect(d.mortgageFirstDeltaBp).toBe(70);
    expect(d.mortgageSecondDeltaBp).toBe(70);
    // 缺失端点
    expect(getLprDelta("2024-01", "2099-01")).toBeNull();
  });

  it("getLprRange 区间全部行", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      L("2024-12", 3.1, 3.6, 3.3, 3.95),
      L("2025-06", 3.0, 3.5, 3.2, 3.85),
      L("2026-01", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const arr = getLprRange("2024-12", "2025-12");
    expect(arr).toHaveLength(2);
    expect(arr[0]!.month).toBe("2024-12");
    expect(arr[1]!.month).toBe("2025-06");
  });

  it("summarizeLprCurrentVsYearAgo 当前 vs 1 年前 bp", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2025-06", 3.0, 3.5, 3.2, 3.85),
      L("2026-06", 3.0, 3.5, 3.2, 3.85) // 不变
    ];
    setSnapshot(snap);
    const r = summarizeLprCurrentVsYearAgo();
    expect(r.current!.month).toBe("2026-06");
    expect(r.yearAgo!.month).toBe("2025-06");
    expect(r.lpr5yDeltaBp).toBe(0);
  });

  it("summarizeLprCurrentVsYearAgo 当年真实降息", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      L("2025-01", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const r = summarizeLprCurrentVsYearAgo();
    expect(r.lpr5yDeltaBp).toBe(70);
    expect(r.mortgageFirstDeltaBp).toBe(70);
  });

  it("getLprLongestFlatStreak 最长不变月数", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      // 2021 全年 3.85 → 4 月 flat，2020 全年 3.85 → 9 月 flat
      L("2020-04", 3.85, 4.65, 4.45, 5.0),
      L("2020-12", 3.85, 4.65, 4.45, 5.0), // 9 个月 4.65
      L("2021-01", 3.85, 4.65, 4.45, 5.0),
      L("2021-12", 3.85, 4.65, 4.45, 5.0), // 12 个月 4.65（连续 21 个月）
      L("2022-05", 3.7, 4.45, 4.25, 4.8) // 变
    ];
    setSnapshot(snap);
    const s = getLprLongestFlatStreak();
    // 4 行连续 4.65（2020-04, 2020-12, 2021-01, 2021-12），最后一行 4.45 触发变化
    expect(s.months).toBe(4);
    expect(s.startMonth).toBe("2020-04");
    expect(s.endMonth).toBe("2021-12");
  });

  it("summarizeLprSpread 首套/二套 vs lpr5y 利差", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 3.45, 4.2, 3.9, 4.55),
      // lpr5y=4.2, 首套 3.9 (实际是负 spread = 折扣 30bp), 二套 4.55 (+35bp)
      L("2026-06", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const r = summarizeLprSpread();
    expect(r.history).toHaveLength(2);
    const cur = r.current!;
    expect(cur.firstSpreadBp).toBe(-30); // 3.2 - 3.5 = -0.3 = -30bp
    expect(cur.secondSpreadBp).toBe(35); // 3.85 - 3.5 = 35bp
    expect(cur.firstSecondDeltaBp).toBe(65); // 3.85 - 3.2 = 65bp
  });

  it("getLprDownwardCumulative 自起点累计降息 bp", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2019-08", 4.25, 4.85, 4.9, 5.2),
      L("2026-06", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const c = getLprDownwardCumulative()!;
    expect(c.startMonth).toBe("2019-08");
    expect(c.endMonth).toBe("2026-06");
    expect(c.lpr5yCumulativeBp).toBe(135); // 4.85-3.5
    expect(c.lpr1yCumulativeBp).toBe(125); // 4.25-3.0
  });

  it("getLprMonthlyAverage 全期平均", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [
      L("2024-01", 4.0, 4.5, 4.2, 4.85),
      L("2024-02", 3.0, 3.5, 3.2, 3.85)
    ];
    setSnapshot(snap);
    const a = getLprMonthlyAverage()!;
    expect(a.monthCount).toBe(2);
    expect(a.lpr5yAvg).toBeCloseTo(4.0, 1); // (4.5+3.5)/2
    expect(a.lpr1yAvg).toBeCloseTo(3.5, 1); // (4.0+3.0)/2
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.lprHistory = [];
    setSnapshot(snap);

    expect(getLprLatest()).toBeNull();
    expect(getLprByYear(2025)).toEqual([]);
    expect(summarizeLprByYear()).toEqual([]);
    expect(detectLprCutCycles()).toEqual([]);
    expect(getLprAtMonth("2025-06")).toBeNull();
    expect(getLprDelta("2024-01", "2025-06")).toBeNull();
    expect(getLprRange("2024-01", "2025-12")).toEqual([]);
    expect(getLprDownwardCumulative()).toBeNull();
    expect(getLprMonthlyAverage()).toBeNull();
    expect(summarizeLprSpread()).toEqual({ current: null, history: [] });
  });
});