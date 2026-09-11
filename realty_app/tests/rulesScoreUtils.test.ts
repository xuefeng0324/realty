import { describe, expect, it, vi } from "vitest";
import {
  clamp,
  parseFloorNumber,
  maybeScaleTrendDelta,
  currentYearFloor,
  jsonListMax
} from "../src/rules/scoreUtils";

/**
 * 评分规则通用工具单测。
 *
 * 重要约束：
 *   - 与 Python 端 realty/backend/app/services/score_utils.py 行为保持完全一致
 *   - clamp(null / NaN, lo, hi) 必须返回 lo（不是 hi，不是 NaN）
 *   - maybeScaleTrendDelta：abs<=1 视为百分比，乘 100；否则原样返回
 *
 * 这些函数被 listingScoring.ts / schoolScoring.ts 等核心评分逻辑调用，
 * 错了整个 App 推荐就崩。8 个边界覆盖：
 */
describe("rules/scoreUtils 通用评分工具", () => {
  describe("clamp", () => {
    it("正常值夹到区间内", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("小于 lo 钳到 lo", () => {
      expect(clamp(-3, 0, 10)).toBe(0);
    });

    it("大于 hi 钳到 hi", () => {
      expect(clamp(20, 0, 10)).toBe(10);
    });

    it("null 钳到 lo（不返回 NaN / 不抛错）", () => {
      expect(clamp(null, 0, 10)).toBe(0);
    });

    it("undefined 钳到 lo", () => {
      expect(clamp(undefined, 0, 10)).toBe(0);
    });

    it("NaN 钳到 lo", () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
    });

    it("lo == hi 边界返回相同值", () => {
      expect(clamp(5, 7, 7)).toBe(7);
      expect(clamp(-100, 7, 7)).toBe(7);
    });
  });

  describe("parseFloorNumber", () => {
    it("正常楼层字符串", () => {
      expect(parseFloorNumber("3")).toBe(3);
      expect(parseFloorNumber("12/30")).toBe(12);
      expect(parseFloorNumber("B1")).toBe(1); // 只匹配数字，不解析 B- 前缀
      expect(parseFloorNumber("+5")).toBe(5);
      expect(parseFloorNumber("中楼层")).toBe(null); // 中文楼层无数字
    });

    it("null / undefined / 空字符串返 null", () => {
      expect(parseFloorNumber(null)).toBe(null);
      expect(parseFloorNumber(undefined)).toBe(null);
      expect(parseFloorNumber("")).toBe(null);
    });

    it("无数字字符返 null", () => {
      expect(parseFloorNumber("未知")).toBe(null);
      expect(parseFloorNumber("---")).toBe(null);
    });
  });

  describe("maybeScaleTrendDelta", () => {
    it("abs <= 1.0 视为百分比，乘 100", () => {
      expect(maybeScaleTrendDelta(0.05)).toBe(5);
      expect(maybeScaleTrendDelta(-0.03)).toBe(-3);
      expect(maybeScaleTrendDelta(0)).toBe(0);
      expect(maybeScaleTrendDelta(1.0)).toBe(100);
      expect(maybeScaleTrendDelta(-1.0)).toBe(-100);
    });

    it("abs > 1.0 当作已 scale 的值，原样返回", () => {
      expect(maybeScaleTrendDelta(1.5)).toBe(1.5);
      expect(maybeScaleTrendDelta(-15.3)).toBe(-15.3);
      expect(maybeScaleTrendDelta(100)).toBe(100);
    });
  });

  describe("currentYearFloor", () => {
    it("不传参返当前年份", () => {
      const expected = new Date().getFullYear();
      expect(currentYearFloor()).toBe(expected);
    });

    it("传 null fallback 到当前年份", () => {
      const expected = new Date().getFullYear();
      expect(currentYearFloor(null)).toBe(expected);
    });

    it("传指定日期返该日期年份", () => {
      expect(currentYearFloor(new Date("2025-03-15"))).toBe(2025);
      expect(currentYearFloor(new Date("1999-12-31"))).toBe(1999);
    });

    it("date mock 后能正确捕获年份", () => {
      // 用 vi.setSystemTime 锁定当前年，避免依赖系统时间
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-06-15"));
      expect(currentYearFloor()).toBe(2027);
      vi.useRealTimers();
    });
  });

  describe("jsonListMax", () => {
    it("正常数组返最大值", () => {
      expect(jsonListMax([1, 5, 3, 9, 2])).toBe(9);
    });

    it("单元素数组", () => {
      expect(jsonListMax([42])).toBe(42);
    });

    it("空数组返 null（不是 0）", () => {
      expect(jsonListMax([])).toBe(null);
    });

    it("null 返 null", () => {
      expect(jsonListMax(null)).toBe(null);
    });

    it("undefined 返 null", () => {
      expect(jsonListMax(undefined)).toBe(null);
    });

    it("负数数组", () => {
      expect(jsonListMax([-3, -1, -7])).toBe(-1);
    });
  });
});