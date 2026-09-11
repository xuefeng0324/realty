import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTrendVisualization } from "../src/composables/useTrendVisualization";
import type {
  BedroomAreaResponse,
  OrientationFloorResponse,
  DecorateAgeResponse,
  CommunityScatterResponse
} from "../src/local/queries";

// mock queries 模块，让 reload 方法可控
vi.mock("../src/local/queries", () => ({
  getBedroomAreaDistribution: vi.fn(),
  getOrientationFloorMatrix: vi.fn(),
  getDecorateAgeMatrix: vi.fn(),
  getCommunityScatter: vi.fn()
}));

/**
 * useTrendVisualization 单测。
 *
 * 包含：
 *   - 4 个 ref + loading/error
 *   - 4 个 reload + reloadAll
 *   - baMaxCount computed（grid 二维数组求最大 cell.count）
 *   - ofCellLabel(cellLabel, ratio)（ratio 正负号处理）
 *   - daCellClass(ratio)（ratio 三段：>0.01 / <-0.01 / [-0.01, 0.01]）
 *   - scatterImproveCohort()（3 cohort: value / mid / premium，按 0.9x / 1.1x 切）
 *   - scatterValueDip()（cityMedianUnit * 0.9 以下数量）
 *
 * 13 个用例覆盖 5 个 helper 函数 + 4 个 reload mock + reloadAll 并发。
 */
describe("composables/useTrendVisualization", () => {
  let hooks: ReturnType<typeof useTrendVisualization>;

  beforeEach(() => {
    hooks = useTrendVisualization();
    vi.clearAllMocks();
  });

  describe("baMaxCount", () => {
    it("bedroomArea null → 0", () => {
      expect(hooks.baMaxCount.value).toBe(0);
    });

    it("grid 空 → 0", () => {
      hooks.bedroomArea.value = { grid: [] } as BedroomAreaResponse;
      expect(hooks.baMaxCount.value).toBe(0);
    });

    it("grid 二维数组 → 返回最大 cell.count", () => {
      hooks.bedroomArea.value = {
        grid: [
          [{ count: 3 }, { count: 7 }],
          [{ count: 12 }, { count: 5 }]
        ]
      } as any;
      expect(hooks.baMaxCount.value).toBe(12);
    });

    it("grid 含负数（异常数据） → 返回最大", () => {
      hooks.bedroomArea.value = {
        grid: [
          [{ count: -5 }, { count: 8 }],
          [{ count: 2 }, { count: 3 }]
        ]
      } as any;
      expect(hooks.baMaxCount.value).toBe(8);
    });
  });

  describe("ofCellLabel", () => {
    it("ratio null → 仅 cellLabel", () => {
      expect(hooks.ofCellLabel("南向", null)).toBe("南向");
    });

    it("ratio=0 → 'cellLabel 0.0%'（pct>0 才加 '+'）", () => {
      expect(hooks.ofCellLabel("南向", 0)).toBe("南向 0.0%");
    });

    it("ratio>0 → 加 '+' 前缀", () => {
      expect(hooks.ofCellLabel("南向", 0.05)).toBe("南向 +5.0%");
      expect(hooks.ofCellLabel("南向", 0.123)).toBe("南向 +12.3%");
    });

    it("ratio<0 → '-' 自然出现在 pct 数字前（不需额外 sign）", () => {
      expect(hooks.ofCellLabel("南向", -0.05)).toBe("南向 -5.0%");
      expect(hooks.ofCellLabel("南向", -0.123)).toBe("南向 -12.3%");
    });
  });

  describe("daCellClass", () => {
    it("ratio null → ''（不渲染涨跌样式）", () => {
      expect(hooks.daCellClass(null)).toBe("");
    });

    it("ratio > 0.01 → 'da-cell--up'", () => {
      expect(hooks.daCellClass(0.02)).toBe("da-cell--up");
      expect(hooks.daCellClass(0.5)).toBe("da-cell--up");
    });

    it("ratio < -0.01 → 'da-cell--down'", () => {
      expect(hooks.daCellClass(-0.02)).toBe("da-cell--down");
      expect(hooks.daCellClass(-0.5)).toBe("da-cell--down");
    });

    it("ratio ∈ [-0.01, 0.01] → 'da-cell--flat'（含 0 / ±0.01 边界）", () => {
      expect(hooks.daCellClass(0)).toBe("da-cell--flat");
      expect(hooks.daCellClass(0.005)).toBe("da-cell--flat");
      expect(hooks.daCellClass(-0.005)).toBe("da-cell--flat");
      expect(hooks.daCellClass(0.01)).toBe("da-cell--flat");
      expect(hooks.daCellClass(-0.01)).toBe("da-cell--flat");
    });
  });

  describe("scatterImproveCohort", () => {
    it("scatter null → 空数组", () => {
      expect(hooks.scatterImproveCohort()).toEqual([]);
    });

    it("按 cityMedianUnit × 0.9 / × 1.1 切 3 cohort", () => {
      hooks.scatter.value = {
        cityMedianUnit: 50000,
        points: [
          // value cohort (medianUnitPrice < 50000*0.9=45000)
          { medianUnitPrice: 40000, medianTotalPrice10w: 800 },
          { medianUnitPrice: 44999, medianTotalPrice10w: 850 },
          // mid cohort (45000 <= p <= 55000)
          { medianUnitPrice: 50000, medianTotalPrice10w: 1000 },
          { medianUnitPrice: 54999, medianTotalPrice10w: 1100 },
          // premium cohort (p > 55000)
          { medianUnitPrice: 60000, medianTotalPrice10w: 1500 },
          { medianUnitPrice: 100000, medianTotalPrice10w: 2500 }
        ]
      } as CommunityScatterResponse;
      const result = hooks.scatterImproveCohort();
      expect(result).toHaveLength(6);
      expect(result.filter((r) => r.cohort === "value")).toHaveLength(2);
      expect(result.filter((r) => r.cohort === "mid")).toHaveLength(2);
      expect(result.filter((r) => r.cohort === "premium")).toHaveLength(2);
      // y 是 10w * 10000 = 元
      expect(result[0].y).toBe(800 * 10000);
      expect(result[4].y).toBe(1500 * 10000);
    });

    it("x 直接是 medianUnitPrice 数值", () => {
      hooks.scatter.value = {
        cityMedianUnit: 50000,
        points: [{ medianUnitPrice: 40000, medianTotalPrice10w: 800 }]
      } as CommunityScatterResponse;
      const result = hooks.scatterImproveCohort();
      expect(result[0].x).toBe(40000);
    });
  });

  describe("scatterValueDip", () => {
    it("scatter null → count=0", () => {
      expect(hooks.scatterValueDip()).toEqual({ count: 0 });
    });

    it("points 全高于 0.9x → count=0", () => {
      hooks.scatter.value = {
        cityMedianUnit: 50000,
        points: [
          { medianUnitPrice: 50000, medianTotalPrice10w: 1000 },
          { medianUnitPrice: 60000, medianTotalPrice10w: 1200 }
        ]
      } as CommunityScatterResponse;
      expect(hooks.scatterValueDip()).toEqual({ count: 0 });
    });

    it("points 3/5 低于 0.9x → count=3", () => {
      hooks.scatter.value = {
        cityMedianUnit: 50000,
        points: [
          { medianUnitPrice: 30000, medianTotalPrice10w: 700 }, // value
          { medianUnitPrice: 40000, medianTotalPrice10w: 800 }, // value
          { medianUnitPrice: 44000, medianTotalPrice10w: 900 }, // value（< 45000）
          { medianUnitPrice: 50000, medianTotalPrice10w: 1000 }, // mid
          { medianUnitPrice: 60000, medianTotalPrice10w: 1500 } // premium
        ]
      } as CommunityScatterResponse;
      expect(hooks.scatterValueDip()).toEqual({ count: 3 });
    });
  });

  describe("reloadAll 并发", () => {
    it("trendVizLoading 切换正确 + error 干净", async () => {
      const { getBedroomAreaDistribution, getOrientationFloorMatrix, getDecorateAgeMatrix, getCommunityScatter } =
        await import("../src/local/queries");
      vi.mocked(getBedroomAreaDistribution).mockResolvedValue({ grid: [] });
      vi.mocked(getOrientationFloorMatrix).mockResolvedValue({});
      vi.mocked(getDecorateAgeMatrix).mockResolvedValue({});
      vi.mocked(getCommunityScatter).mockResolvedValue({ cityMedianUnit: 0, points: [] });

      await hooks.reloadAll(2);
      expect(hooks.trendVizLoading.value).toBe(false);
      expect(hooks.trendVizError.value).toBe(null);
    });
  });
});