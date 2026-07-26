import { describe, expect, it } from "vitest";
import {
  buildCountHeatCircles,
  buildPriceBuckets,
  buildPriceHeatCircles,
  formatPriceRangeK,
  heatRadius,
  normalizeRange,
  priceColorRamp5
} from "../src/local/mapMath";

describe("地图热力计算（逻辑完整性）", () => {
  it("价格归一化遵循括号后的正确优先级", () => {
    expect(normalizeRange(30000, 20000, 40000)).toBe(0.5);
    expect(normalizeRange(10000, 20000, 40000)).toBe(0);
    expect(normalizeRange(50000, 20000, 40000)).toBe(1);
  });

  it("半径始终限制在 200-1000 米", () => {
    expect(heatRadius(0, 0)).toBe(200);
    expect(heatRadius(1, 1)).toBe(1000);
    expect(heatRadius(0.5, 0.5)).toBe(600);
  });

  it("图例区间不得再算成 0k-0k（历史 bug）", () => {
    expect(formatPriceRangeK(30000, 45000)).toBe("30k-45k");
    expect(formatPriceRangeK(54766, 120000)).toBe("55k-120k");
    expect(formatPriceRangeK(800, 1500)).toBe("1k-2k");
    // 旧实现：round(min/1000) 再 /1000 → 全 0
    expect(formatPriceRangeK(20000, 80000)).not.toBe("0k-0k");
  });

  it("无有效价格时图例返回空，文案为 —", () => {
    expect(buildPriceBuckets([])).toEqual([]);
    expect(formatPriceRangeK(0, 0)).toBe("—");
    expect(formatPriceRangeK(Number.NaN, 10)).toBe("—");
  });

  it("5 档分位桶覆盖最便宜/最贵且区间单调", () => {
    const prices = [20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];
    const buckets = buildPriceBuckets(prices);
    expect(buckets).toHaveLength(5);
    expect(buckets[0].label).toContain("最便宜");
    expect(buckets[4].label).toContain("最贵");
    for (let i = 0; i < buckets.length; i++) {
      expect(buckets[i].min).toBeLessThanOrEqual(buckets[i].max);
      expect(formatPriceRangeK(buckets[i].min, buckets[i].max)).not.toMatch(/^0k-0k/);
    }
    expect(buckets[0].min).toBe(20000);
    expect(buckets[4].max).toBe(100000);
  });

  it("挂牌均价色阶输出 8 位 hex（App map 要求，禁止 rgb()）", () => {
    const c0 = priceColorRamp5(0);
    const c1 = priceColorRamp5(1);
    expect(c0).toMatch(/^#[0-9a-f]{8}$/i);
    expect(c1).toMatch(/^#[0-9a-f]{8}$/i);
    expect(c0).not.toMatch(/^rgb/i);
  });

  it("price 模式只画有均价社区，不铺灰色糊底", () => {
    const communities = [
      { lat: 22.5, lng: 114.0, listingCount: 10, avgUnitPrice: 50000 },
      { lat: 22.51, lng: 114.01, listingCount: 5, avgUnitPrice: 80000 },
      { lat: 22.52, lng: 114.02, listingCount: 20, avgUnitPrice: null },
      { lat: 22.53, lng: 114.03, listingCount: 3, avgUnitPrice: 0 }
    ];
    const circles = buildPriceHeatCircles(communities);
    expect(circles).toHaveLength(2);
    for (const c of circles) {
      expect(c.fillColor).toMatch(/^#[0-9a-f]{8}$/i);
      expect(c.fillColor.toLowerCase()).not.toContain("94a3b8");
      expect(c.radius).toBeGreaterThanOrEqual(200);
      expect(c.radius).toBeLessThanOrEqual(1000);
    }
    // 贵的应不比便宜的更「冷」：t 更大 → 更偏红（r 通道更大或相等）
    const cheap = circles[0].fillColor.slice(1, 3);
    const expensive = circles[1].fillColor.slice(1, 3);
    expect(parseInt(expensive, 16)).toBeGreaterThanOrEqual(parseInt(cheap, 16));
  });

  it("count 模式覆盖全部社区", () => {
    const communities = [
      { lat: 22.5, lng: 114.0, listingCount: 1, avgUnitPrice: null },
      { lat: 22.51, lng: 114.01, listingCount: 9, avgUnitPrice: 1 }
    ];
    expect(buildCountHeatCircles(communities)).toHaveLength(2);
  });
});
