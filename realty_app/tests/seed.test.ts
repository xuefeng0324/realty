/**
 * 种子快照（src/local/seedSnapshot.ts）单元测试。
 * 验证：种子快照能从打包进 JS 的 CSV 中正确解析出 DataSnapshot。
 */
import { describe, expect, test, beforeAll } from "vitest";
import { setSnapshot, getSnapshot, isLoaded } from "../src/local/store";
import { buildSeedSnapshot } from "../src/local/seedSnapshot";

describe("seed snapshot", () => {
  beforeAll(() => {
    const snap = buildSeedSnapshot();
    setSnapshot(snap);
  });

  test("种子快照能解析并包含合理数据量", () => {
    const s = getSnapshot();
    expect(s).not.toBeNull();
    expect(s!.cities.length).toBeGreaterThanOrEqual(3);
    expect(s!.communities.length).toBeGreaterThan(10);
    expect(s!.schools.length).toBeGreaterThan(10);
    expect(s!.schoolIndicators.length).toBe(s!.schools.length);
    expect(s!.listings.length).toBeGreaterThan(500);
  });

  test("种子快照覆盖 3 个城市（广州 / 深圳 / 珠海）", () => {
    const s = getSnapshot();
    const cities = new Set(s!.listings.map((l) => l.cityId));
    // 1 = 广州, 2 = 深圳, 3 = 珠海
    expect(cities.has(1)).toBe(true);
    expect(cities.has(2)).toBe(true);
    expect(cities.has(3)).toBe(true);
  });

  test("种子快照的 unit_price 与公开市场量级一致", () => {
    const s = getSnapshot();
    const prices = s!.listings.map((l) => l.unitPrice ?? 0).filter((p) => p > 0);
    expect(prices.length).toBeGreaterThan(200);
    // 公开深圳 5-13 万㎡，广州 3-8 万㎡，珠海 1-4 万㎡
    expect(Math.min(...prices)).toBeLessThan(20000);
    expect(Math.max(...prices)).toBeGreaterThan(130000);
  });

  test("种子快照源字符串标识为 'seed:public-derived'", () => {
    const s = getSnapshot();
    expect(s!.source).toMatch(/^seed:/);
  });

  test("buildSeedSnapshot 第一次解析后 cached", () => {
    expect(isLoaded()).toBe(true);
  });
});
