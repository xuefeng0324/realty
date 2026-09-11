import { describe, expect, it } from "vitest";
import {
  median,
  computeWeekWindow,
  generateWeeklySnapshot,
  SNAPSHOT_DEFAULTS
} from "../src/rules/snapshot";

/**
 * 周快照规则单测。
 *
 * 重要约束：
 *   - median([]) 必须返 0（不是 NaN）
 *   - generateWeeklySnapshot：unitPrices 全过滤后必须返 null
 *     （不要静默返个假平均）
 *   - policy 切换：samples >= minSamplesForLatest 时，
 *     |latest-median|/median <= deviationThreshold 用 latest；
 *     否则用 median_robust。
 *
 * 8 个边界覆盖（对应 Python snapshot_service.py 行为）。
 */
describe("rules/snapshot 周快照规则", () => {
  describe("median", () => {
    it("空数组返 0（不是 NaN）", () => {
      expect(median([])).toBe(0);
    });

    it("单元素数组", () => {
      expect(median([42])).toBe(42);
    });

    it("奇数个元素取中间", () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
      expect(median([5, 3, 1, 4, 2])).toBe(3); // 乱序输入也能正确排序
    });

    it("偶数个元素取中间两个的平均", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("负数数组", () => {
      expect(median([-3, -1, -2])).toBe(-2);
    });

    it("不修改原数组（spread 排序）", () => {
      const orig = [3, 1, 2];
      median(orig);
      expect(orig).toEqual([3, 1, 2]);
    });
  });

  describe("computeWeekWindow", () => {
    it("weekEnd + 6 天回退 = weekStart", () => {
      const { start, end } = computeWeekWindow("2026-03-15");
      expect(end).toBe("2026-03-15");
      expect(start).toBe("2026-03-09");
    });

    it("跨月边界", () => {
      const { start, end } = computeWeekWindow("2026-04-03");
      expect(end).toBe("2026-04-03");
      expect(start).toBe("2026-03-28");
    });

    it("跨年边界", () => {
      const { start, end } = computeWeekWindow("2026-01-03");
      expect(end).toBe("2026-01-03");
      expect(start).toBe("2025-12-28");
    });

    it("闰年 2 月", () => {
      const { start, end } = computeWeekWindow("2024-03-01");
      expect(end).toBe("2024-03-01");
      expect(start).toBe("2024-02-24");
    });

    it("非闰年 2 月", () => {
      const { start, end } = computeWeekWindow("2025-03-01");
      expect(end).toBe("2025-03-01");
      expect(start).toBe("2025-02-23"); // 3-1-6 = 2-23（非闰年）
    });
  });

  describe("generateWeeklySnapshot", () => {
    const baseInput = {
      communityId: 1,
      weekEndDate: "2026-03-15",
      unitPrices: [50000, 51000, 49000, 50500, 49500]
    };

    it("unitPrices 全被过滤（< min）返 null（不静默写假数据）", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [500, 200, 100] // 全 < unitPriceMin (1000)
      });
      expect(result).toBe(null);
    });

    it("unitPrices 全被过滤（> max）返 null", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [300000, 250000, 999999] // 全 > unitPriceMax (200000)
      });
      expect(result).toBe(null);
    });

    it("unitPrices 为空数组返 null", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: []
      });
      expect(result).toBe(null);
    });

    it("samples < minSamplesForLatest 用 median_robust 策略", () => {
      // 5 个样本里 median=50000，latest=50000，deviation=0，但 samples=5 >= 5 满足
      // 改成只有 4 个样本触发 minSamplesForLatest 分支
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [50000, 51000, 49000, 50500] // 4 < 5 (minSamplesForLatest)
      });
      expect(result).not.toBe(null);
      expect(result!.dataPolicy).toBe("median_robust");
      expect(result!.avgUnitPrice).toBe(50250); // median of [49000, 50000, 50500, 51000]
      expect(result!.listingCount).toBe(4);
    });

    it("samples 充足 + latest 与 median 接近 → latest_non_null 策略", () => {
      // 6 个样本，median=(50000+50500)/2=50250，latest=50500，deviation=0.005 < 0.25
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [50500, 50000, 49500, 51000, 49000, 50500] // 6 个，latest=50500
      });
      expect(result).not.toBe(null);
      expect(result!.dataPolicy).toBe("latest_non_null");
      expect(result!.avgUnitPrice).toBe(50500); // 用 latest，不是 median
      expect(result!.medianUnitPrice).toBe(50250); // median 仍记
      expect(result!.listingCount).toBe(6);
    });

    it("samples 充足 + latest 与 median 偏差 > 25% → median_robust 策略", () => {
      // latest=100000，median 约 50000，deviation=1.0 > 0.25
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [100000, 50000, 49000, 51000, 49500, 50500]
      });
      expect(result).not.toBe(null);
      expect(result!.dataPolicy).toBe("median_robust");
      expect(result!.avgUnitPrice).toBe(result!.medianUnitPrice);
    });

    it("coverageScore < 1.0 当 samples < targetListingCount", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: Array(15).fill(50000) // 15 < 30
      });
      expect(result).not.toBe(null);
      expect(result!.coverageScore).toBe(15 / SNAPSHOT_DEFAULTS.targetListingCount);
      expect(result!.coverageScore).toBeLessThan(1);
    });

    it("coverageScore = 1.0 当 samples >= targetListingCount", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: Array(40).fill(50000)
      });
      expect(result).not.toBe(null);
      expect(result!.coverageScore).toBe(1.0);
    });

    it("weekStartDate 和 weekEndDate 由 computeWeekWindow 派生", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [50000]
      });
      expect(result!.weekEndDate).toBe("2026-03-15");
      expect(result!.weekStartDate).toBe("2026-03-09");
    });

    it("communityId 透传", () => {
      const result = generateWeeklySnapshot({
        communityId: 42,
        weekEndDate: "2026-03-15",
        unitPrices: [50000]
      });
      expect(result!.communityId).toBe(42);
    });

    it("sourcePriorityUsed 固定为 listing_detail_unit_price", () => {
      const result = generateWeeklySnapshot({
        ...baseInput,
        unitPrices: [50000]
      });
      expect(result!.sourcePriorityUsed).toBe("listing_detail_unit_price");
    });
  });
});