import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverageText,
  daysAgoFromToday,
  dimensionLabelCN,
  formatArea,
  formatPrice,
  formatUnitPrice,
  scoreClass,
  showToast
} from "../src/utils/format";

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).uni;
});

describe("显示格式与日期边界", () => {
  it("总价正确显示空值、万元和亿元", () => {
    expect(formatPrice(null)).toBe("-");
    expect(formatPrice(999.6)).toBe("1000万");
    expect(formatPrice(12345)).toBe("1.23亿");
  });

  it("单价和面积正确处理空值与小数", () => {
    expect(formatUnitPrice(undefined)).toBe("-");
    expect(formatUnitPrice(123456)).toContain("123,456");
    expect(formatArea(null)).toBe("-");
    expect(formatArea(88.86)).toBe("88.9㎡");
  });

  it("评分颜色边界为60和80", () => {
    expect(scoreClass(null)).toBe("score-mid");
    expect(scoreClass(59.9)).toBe("score-low");
    expect(scoreClass(60)).toBe("score-mid");
    expect(scoreClass(80)).toBe("score-high");
  });

  it("覆盖率按百分比四舍五入", () => {
    expect(coverageText(null)).toBe("-");
    expect(coverageText(0.876)).toBe("88%");
  });

  it("维度名称有中文映射，未知值原样返回", () => {
    expect(dimensionLabelCN("location_score")).toBe("地段");
    expect(dimensionLabelCN("price_value_score")).toBe("性价比");
    expect(dimensionLabelCN("custom_score")).toBe("custom_score");
  });

  it("自然日计算不受当前时刻影响", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 25, 23, 59, 59));
    expect(daysAgoFromToday("2026-07-25")).toBe(0);
    expect(daysAgoFromToday("2026-07-24T23:59:59")).toBe(1);
    expect(daysAgoFromToday("2026-07-26")).toBe(-1);
  });

  it("缺失、格式错误和不存在的日历日期返回null", () => {
    expect(daysAgoFromToday(null)).toBeNull();
    expect(daysAgoFromToday("2026/07/25")).toBeNull();
    expect(daysAgoFromToday("2026-02-30")).toBeNull();
    expect(daysAgoFromToday("2026-13-01")).toBeNull();
  });

  it("toast使用统一时长和默认图标", () => {
    const showToastMock = vi.fn();
    (globalThis as any).uni = { showToast: showToastMock };
    showToast("完成");
    expect(showToastMock).toHaveBeenCalledWith({ title: "完成", icon: "none", duration: 2000 });
  });
});
