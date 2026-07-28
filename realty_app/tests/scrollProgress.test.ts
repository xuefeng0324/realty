import { describe, expect, it } from "vitest";
import {
  fractionFromTouch,
  maxScroll,
  scrollFraction,
  scrollTopFromFraction,
  thumbLength,
  thumbOffset
} from "../src/utils/scrollProgress";

describe("scrollProgress 数学", () => {
  it("maxScroll = 内容高 - 视口高（下限 0）", () => {
    expect(maxScroll(2000, 800)).toBe(1200);
    expect(maxScroll(600, 800)).toBe(0);
    expect(maxScroll(NaN, 800)).toBe(0);
  });

  it("scrollFraction：0 顶端 / 1 底端 / 内容不足恒 0", () => {
    expect(scrollFraction(0, 2000, 800)).toBe(0);
    expect(scrollFraction(1200, 2000, 800)).toBe(1);
    expect(scrollFraction(600, 2000, 800)).toBeCloseTo(0.5, 5);
    expect(scrollFraction(500, 600, 800)).toBe(0); // 内容 < 视口
  });

  it("scrollFraction 超界被夹紧到 0..1", () => {
    expect(scrollFraction(-100, 2000, 800)).toBe(0);
    expect(scrollFraction(99999, 2000, 800)).toBe(1);
  });

  it("scrollTopFromFraction 与 scrollFraction 互逆", () => {
    const top = scrollTopFromFraction(0.5, 2000, 800);
    expect(top).toBe(600);
    expect(scrollFraction(top, 2000, 800)).toBeCloseTo(0.5, 5);
  });

  it("thumbLength 至少 minThumb，且随可视占比放大", () => {
    // 视口占内容 40% → thumb ≈ 0.4 * track，但不低于 minThumb
    expect(thumbLength(2000, 800, 400, 48)).toBe(160);
    expect(thumbLength(20000, 800, 400, 48)).toBe(48); // 极长内容 → 触底 minThumb
  });

  it("thumbOffset 顶端 0、底端 = track-thumb", () => {
    expect(thumbOffset(0, 400, 100)).toBe(0);
    expect(thumbOffset(1, 400, 100)).toBe(300);
    expect(thumbOffset(0.5, 400, 100)).toBe(150);
  });

  it("fractionFromTouch 以 thumb 中心对齐（起手不跳格）", () => {
    // 手指落在 thumb 中心处 → 对应占比 = (touch - thumb/2)/(track-thumb)
    // track=400 thumb=100 → travel=300；touch=200 → (200-50)/300 = 0.5
    expect(fractionFromTouch(200, 400, 100)).toBeCloseTo(0.5, 5);
    expect(fractionFromTouch(0, 400, 100)).toBe(0);
    expect(fractionFromTouch(1000, 400, 100)).toBe(1);
  });
});
