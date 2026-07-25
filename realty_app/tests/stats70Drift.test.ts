import { describe, expect, it, beforeEach } from "vitest";
import {
  loadStats70FromCSV,
  getCityDriftOverLastYear,
  summarizeCityDrift
} from "../src/local/stats70";

const CSV = [
  "date,city,fixed_base,new_idx,second_idx",
  // 北京：prior=100, recent=[101..112]：recent avg=106.5 → drift>0
  ...twoYearsOf(
    "北京",
    Array(12).fill(100),
    [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]
  ),
  // 上海：prior=120, recent=[100..89]：recent avg≈94.5, prior avg=120 → drift<0
  ...twoYearsOf(
    "上海",
    Array(12).fill(120),
    [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89]
  ),
  // 广州：prior=100, recent=100 → drift=0
  ...twoYearsOf(
    "广州",
    Array(12).fill(100),
    Array(12).fill(100)
  )
].join("\n");

/** Build rows for 24 months: 12 prior (year N-1) + 12 recent (year N).
 *  Both 同比 + 环比 指数独立给出序列，便于分别测趋势。 */
function twoYearsOf(
  city: string,
  recentNewYoY: number[],
  recentSecondYoY: number[],
  recentNewMoM: number[] = recentNewYoY,
  recentSecondMoM: number[] = recentSecondYoY
): string[] {
  if (recentNewYoY.length !== 12 || recentSecondYoY.length !== 12) {
    throw new Error("expected 12 entries each for the recent year");
  }
  const rows: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    const isPrior = i < 12;
    const yearOffset = isPrior ? 2024 : 2025;
    const month = (i % 12) + 1;
    const date = `${yearOffset}/${month}/1`;
    let yoyNew: number;
    let yoySecond: number;
    let momNew: number;
    let momSecond: number;
    if (isPrior) {
      // prior year: stay flat (will be the baseline)
      yoyNew = 100;
      yoySecond = 100;
      momNew = 100;
      momSecond = 100;
    } else {
      yoyNew = recentNewYoY[i - 12];
      yoySecond = recentSecondYoY[i - 12];
      momNew = recentNewMoM[i - 12];
      momSecond = recentSecondMoM[i - 12];
    }
    rows.push(`${date},${city},同比,${yoyNew},${yoySecond}`);
    rows.push(`${date},${city},环比,${momNew},${momSecond}`);
  }
  return rows;
}

describe("v0.91.0 70 城 12 月派生", () => {
  beforeEach(() => {
    loadStats70FromCSV(CSV);
  });

  it("drift > 0 表示 12 月趋势扩张", () => {
    const sum = getCityDriftOverLastYear("同比", "second");
    const bj = sum.find((s) => s.city === "北京");
    expect(bj?.drift).toBeGreaterThan(0);
    expect(bj?.recentAvg).toBeCloseTo(106.5, 1);
  });

  it("drift < 0 表示 12 月趋势收缩", () => {
    const sum = getCityDriftOverLastYear("同比", "second");
    const sh = sum.find((s) => s.city === "上海");
    expect(sh?.drift).toBeLessThan(0);
  });

  it("12 月趋势持平 => drift = 0（不归 expanding / contracting）", () => {
    const sum = getCityDriftOverLastYear("同比", "second");
    const gz = sum.find((s) => s.city === "广州");
    expect(gz?.drift).toBe(0);
    const dist = summarizeCityDrift(sum);
    expect(dist.expanding.map((s) => s.city)).toContain("北京");
    expect(dist.contracting.map((s) => s.city)).toContain("上海");
    expect(dist.expanding.map((s) => s.city)).not.toContain("广州");
    expect(dist.contracting.map((s) => s.city)).not.toContain("广州");
  });

  it("summarizeCityDrift 排序: expanding 降序, contracting 升序", () => {
    const sum = getCityDriftOverLastYear("同比", "second");
    const dist = summarizeCityDrift(sum);
    // Only 北京 expands, only 上海 contracts, so we expect single-element lists
    expect(dist.expanding.length).toBe(1);
    expect(dist.contracting.length).toBe(1);
    expect(dist.totalCities).toBe(3);
  });

  it("latest / latestDate 字段返回最近一月的指数", () => {
    const sum = getCityDriftOverLastYear("同比", "second");
    const bj = sum.find((s) => s.city === "北京");
    expect(bj?.latest).toBe(112);
    expect(bj?.latestDate).toBe("2025/12/1");
  });

  it("数据不足 24 月时 drift 应为 null，不报错", () => {
    const minimalCsv = [
      "date,city,fixed_base,new_idx,second_idx",
      "2025/6/1,海口,同比,100,101",
      "2025/7/1,海口,同比,100,102",
      "2025/8/1,海口,同比,100,103"
    ].join("\n");
    loadStats70FromCSV(minimalCsv);
    const sum = getCityDriftOverLastYear("同比", "second");
    const hk = sum.find((s) => s.city === "海口");
    expect(hk?.drift).toBeNull();
    expect(hk?.latest).toBe(103);
  });
});
