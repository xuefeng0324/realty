import { describe, expect, it, vi } from "vitest";
import {
  isDashboardGuideDismissed,
  shouldShowDashboardGuide,
  DASHBOARD_GUIDE_KEY
} from "../src/utils/dashboardGuide";

/**
 * 首页「使用指南」banner 显示状态。详见 src/utils/dashboardGuide.ts。
 *
 * 关键约束（防止 UI 白闪）：
 *   - 必须在 setup 同步读 storage；首帧不该先 true 后改 false
 *   - getStorage 抛错时静默返回 false（= 仍显示指南）
 *   - getStorage 返回 JSON 字符串时 parse 失败也算 false
 *
 * 边界覆盖（8 cases）：
 *   1. 未设置（undefined）→ false（显示）
 *   2. 空字符串 → false（显示）
 *   3. JSON 字符串 "true" → true（隐藏）
 *   4. JSON 字符串 "false" → false（显示）
 *   5. JSON 字符串 "abc" parse fail → false（显示，catch）
 *   6. boolean true → true（隐藏）
 *   7. boolean false → false（显示）
 *   8. getStorage 抛错 → false（显示，catch）
 *
 * shouldShowDashboardGuide 是 isDashboardGuideDismissed 的反义，确保首帧判断一致。
 */
describe("dashboardGuide 显示状态", () => {
  it("storage 未设置时显示指南", () => {
    expect(isDashboardGuideDismissed(() => undefined)).toBe(false);
    expect(shouldShowDashboardGuide(() => undefined)).toBe(true);
  });

  it("storage 空字符串时显示指南", () => {
    expect(isDashboardGuideDismissed(() => "")).toBe(false);
    expect(shouldShowDashboardGuide(() => "")).toBe(true);
  });

  it("JSON 字符串 'true' 时隐藏指南", () => {
    expect(isDashboardGuideDismissed(() => "true")).toBe(true);
    expect(shouldShowDashboardGuide(() => "true")).toBe(false);
  });

  it("JSON 字符串 'false' 时显示指南", () => {
    expect(isDashboardGuideDismissed(() => "false")).toBe(false);
    expect(shouldShowDashboardGuide(() => "false")).toBe(true);
  });

  it("JSON 字符串 parse 失败时仍显示指南（不抛错）", () => {
    expect(isDashboardGuideDismissed(() => "{not valid json")).toBe(false);
    expect(shouldShowDashboardGuide(() => "{not valid json")).toBe(true);
  });

  it("storage 直接是 boolean true 时隐藏指南", () => {
    expect(isDashboardGuideDismissed(() => true)).toBe(true);
    expect(shouldShowDashboardGuide(() => true)).toBe(false);
  });

  it("storage 直接是 boolean false 时显示指南", () => {
    expect(isDashboardGuideDismissed(() => false)).toBe(false);
    expect(shouldShowDashboardGuide(() => false)).toBe(true);
  });

  it("getStorage 抛错时仍显示指南（不传播异常）", () => {
    const throwing = vi.fn(() => {
      throw new Error("storage broken");
    });
    expect(() => isDashboardGuideDismissed(throwing)).not.toThrow();
    expect(isDashboardGuideDismissed(throwing)).toBe(false);
    expect(shouldShowDashboardGuide(throwing)).toBe(true);
  });

  it("DASHBOARD_GUIDE_KEY 常量稳定（防止被误改导致用户「已关闭」状态丢失）", () => {
    expect(DASHBOARD_GUIDE_KEY).toBe("realty_dashboard_guide_dismissed");
  });
});