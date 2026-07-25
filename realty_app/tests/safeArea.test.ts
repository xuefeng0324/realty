import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("cross-platform safe area", () => {
  it("defines global safe-area variables and applies horizontal page padding", () => {
    const app = read("src/App.vue");
    expect(app).toContain("--safe-area-bottom: env(safe-area-inset-bottom, 0px)");
    expect(app).toContain("padding-left: calc(24rpx + var(--safe-area-left))");
    expect(app).toContain("padding-right: calc(24rpx + var(--safe-area-right))");
  });

  it.each([
    "src/pages/dashboard/dashboard.vue",
    "src/pages/listing-filter/listing-filter.vue",
    "src/pages/wangqian/wangqian.vue"
  ])("keeps bottom sheets above the home indicator: %s", (path) => {
    expect(read(path)).toContain("padding: 16rpx 0 calc(16rpx + var(--safe-area-bottom, 0px))");
  });

  it("keeps the map detail card above the tab bar and home indicator", () => {
    expect(read("src/pages/map-view/map-view.vue")).toContain(
      "bottom: calc(24rpx + var(--window-bottom, 0px) + var(--safe-area-bottom, 0px))"
    );
  });
});
