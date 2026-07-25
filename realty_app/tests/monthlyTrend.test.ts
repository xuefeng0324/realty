import { describe, expect, it, beforeEach } from "vitest";
import {
  loadDailyWangqianFromCSV,
  getMonthlyTrendFromDaily,
  summarizeMonthlyTrend
} from "../src/local/dailyWangqian";

const CSV = `date,city,category,scope,district,units,area_sqm,granularity,source_url
2026-01-05,深圳,新房,住宅,全市,10,1000,city,http://x
2026-01-10,深圳,新房,住宅,全市,12,1200,city,http://x
2026-02-03,深圳,新房,住宅,全市,15,1500,city,http://x
2026-03-04,深圳,新房,住宅,全市,5,500,city,http://x
2026-04-02,深圳,新房,住宅,全市,30,3000,city,http://x
2026-01-08,深圳,二手,住宅,全市,8,800,city,http://x
2026-02-09,深圳,二手,住宅,全市,11,1100,city,http://x
2026-03-11,深圳,二手,住宅,全市,9,900,city,http://x
2026-04-12,深圳,二手,住宅,全市,16,1600,city,http://x
2026-05-01,深圳,新房,住宅,南山区,99,9000,district,http://x`;

describe("v0.89.0 月度成交派生", () => {
  beforeEach(() => {
    loadDailyWangqianFromCSV(CSV);
  });

  it("新房月度聚合套数 / 面积 / 交易日数都正确", () => {
    const series = getMonthlyTrendFromDaily("深圳", "新房");
    expect(series.length).toBeGreaterThanOrEqual(4);
    const jan = series.find((b) => b.month.startsWith("2026-01"));
    expect(jan?.units).toBe(22); // 10 + 12
    expect(jan?.days).toBe(2);
    expect(jan?.area_sqm).toBe(2200);
    const apr = series.find((b) => b.month.startsWith("2026-04"));
    expect(apr?.units).toBe(30);
  });

  it("summary 提供环比 / 同比", () => {
    const series = getMonthlyTrendFromDaily("深圳", "新房");
    const sum = summarizeMonthlyTrend(series);
    expect(sum.total).toBe(series.length);
    expect(sum.latest).not.toBeNull();
    // 最新一个月 (2026-04) = 30, 前一月 (2026-03) = 5
    expect(sum.momUnits).toBeCloseTo((30 - 5) / 5, 3);
    // 不足 13 个月 → yoy 应为 null
    expect(sum.yoyUnits).toBeNull();
  });

  it("二手与新房独立聚合", () => {
    const a = getMonthlyTrendFromDaily("深圳", "新房");
    const b = getMonthlyTrendFromDaily("深圳", "二手");
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    // 同一自然月下，值应不同（数据本身不一致）
    const monthA = a.find((x) => x.month.startsWith("2026-02"));
    const monthB = b.find((x) => x.month.startsWith("2026-02"));
    expect(monthA?.units).toBe(15);
    expect(monthB?.units).toBe(11);
  });

  it("分区粒度行被排除（避免重复计数）", () => {
    // CSV 末尾有一条 2026-05-01 的 district=南山区, units=99 的行，
    // 即便被错过写入，新房 series 不应包含 2026-05 这个月。
    const series = getMonthlyTrendFromDaily("深圳", "新房");
    const may = series.find((b) => b.month.startsWith("2026-05"));
    expect(may).toBeUndefined();
  });

  it("空数据 / 不存在的城市 → 返回空数组 / 默认 summary", () => {
    const empty = getMonthlyTrendFromDaily("上海", "新房");
    expect(empty).toEqual([]);
    const sum = summarizeMonthlyTrend(empty);
    expect(sum.latest).toBeNull();
    expect(sum.total).toBe(0);
  });
});
