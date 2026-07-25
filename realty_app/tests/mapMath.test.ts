import { describe, expect, it } from "vitest";
import { heatRadius, normalizeRange } from "../src/local/mapMath";

describe("地图热力计算", () => {
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
});
