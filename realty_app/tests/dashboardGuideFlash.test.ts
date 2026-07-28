import { describe, expect, it } from "vitest";
import {
  DASHBOARD_GUIDE_KEY,
  isDashboardGuideDismissed,
  shouldShowDashboardGuide
} from "../src/utils/dashboardGuide";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dashboardGuide util（首屏已不渲染指南卡）", () => {
  it("已关闭时 shouldShow=false", () => {
    const store = new Map([[DASHBOARD_GUIDE_KEY, JSON.stringify(true)]]);
    expect(isDashboardGuideDismissed((k) => store.get(k))).toBe(true);
    expect(shouldShowDashboardGuide((k) => store.get(k))).toBe(false);
  });

  it("未关闭时 shouldShow=true（util 行为保留）", () => {
    expect(shouldShowDashboardGuide(() => "")).toBe(true);
  });

  it("dashboard 首屏不再挂指南 banner，避免占位与白闪面", () => {
    const dash = readFileSync(
      resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"),
      "utf8"
    );
    expect(dash).not.toContain("data-dash-guide");
    expect(dash).not.toContain("showGuide");
  });
});
