import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DASHBOARD_GUIDE_KEY,
  isDashboardGuideDismissed,
  shouldShowDashboardGuide
} from "../src/utils/dashboardGuide";

describe("dashboardGuide 首帧不白闪", () => {
  it("已关闭时 shouldShow=false", () => {
    const store = new Map([[DASHBOARD_GUIDE_KEY, JSON.stringify(true)]]);
    expect(isDashboardGuideDismissed((k) => store.get(k))).toBe(true);
    expect(shouldShowDashboardGuide((k) => store.get(k))).toBe(false);
  });

  it("未关闭时 shouldShow=true", () => {
    expect(shouldShowDashboardGuide(() => "")).toBe(true);
  });

  it("dashboard.vue 用同步 shouldShowDashboardGuide 初始化，禁止 ref(true)+onMounted 再关", () => {
    const dash = readFileSync(
      resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    expect(dash).toContain("shouldShowDashboardGuide");
    expect(dash).toMatch(/showGuide\s*=\s*ref(?:<boolean>)?\(\s*shouldShowDashboardGuide\(\)/);
    // 默认 .home-guide-card 不得硬编码浅色渐变（浅色仅允许在 [data-realty-theme="light"] 下）
    const defaultBlock = dash.match(/\.home-guide-card\s*\{[\s\S]*?\n\}/);
    expect(defaultBlock?.[0] ?? "").not.toContain("#f0f4ff");
    expect(defaultBlock?.[0] ?? "").not.toContain("#fef3c7");
    expect(defaultBlock?.[0] ?? "").toMatch(/rgba\(34,\s*197,\s*94/);
  });
});
