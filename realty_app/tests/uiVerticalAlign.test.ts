import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function ruleBody(src: string, selectorHead: string): string {
  // 允许「.a,\\nbutton.a」这类多选择器；空白宽松匹配
  const head = selectorHead
    .split(",")
    .map((p) => p.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*,\\s*");
  const re = new RegExp(`${head}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const m = src.match(re);
  expect(m, `missing CSS rule for ${selectorHead}`).toBeTruthy();
  return m![1];
}

function expectFlexCenter(body: string, label: string) {
  expect(body, label).toMatch(/display:\s*(inline-)?flex/);
  expect(body, label).toMatch(/align-items:\s*center/);
  expect(body, label).toMatch(/justify-content:\s*center/);
}

describe("single-line control vertical centering (source guard)", () => {
  it("App.vue button defaults to flex center (covers custom CTAs)", () => {
    const body = ruleBody(read("src/App.vue"), "button");
    expectFlexCenter(body, "global button");
    expect(body).toContain("box-sizing: border-box");
  });

  it("listing-filter keyword input uses height == line-height", () => {
    const body = ruleBody(read("src/pages/listing-filter/listing-filter.vue"), ".search-input .input");
    expect(body).toMatch(/height:\s*64rpx/);
    expect(body).toMatch(/line-height:\s*64rpx/);
    expect(body).toContain("box-sizing: border-box");
  });

  it("dashboard home search input uses height == line-height", () => {
    const body = ruleBody(read("src/pages/dashboard/dashboard.vue"), ".home-search-input");
    expect(body).toMatch(/height:\s*64rpx/);
    expect(body).toMatch(/line-height:\s*64rpx/);
    expect(body).toContain("box-sizing: border-box");
  });

  it("dashboard home search button is flex-centered", () => {
    expectFlexCenter(ruleBody(read("src/pages/dashboard/dashboard.vue"), ".home-search-btn"), "home-search-btn");
  });

  it("listing-detail source dock buttons are flex-centered", () => {
    const detail = read("src/pages/listing-detail/listing-detail.vue");
    expectFlexCenter(ruleBody(detail, ".source-dock-primary, button.source-dock-primary"), "source-dock-primary");
    expectFlexCenter(ruleBody(detail, ".source-dock-ghost, button.source-dock-ghost"), "source-dock-ghost");
  });

  it("map filter/mode chips are flex-centered", () => {
    const map = read("src/pages/map-view/map-view.vue");
    expectFlexCenter(ruleBody(map, ".map-mode-btn"), "map-mode-btn");
    expectFlexCenter(ruleBody(map, ".map-filter-btn"), "map-filter-btn");
  });

  it("school/settings single-line inputs have box-sizing + min-height", () => {
    for (const path of ["src/pages/school/school.vue", "src/pages/settings/settings.vue"] as const) {
      const src = read(path);
      // school shares .picker-value,.input — settings only .input
      const body = path.includes("school")
        ? ruleBody(src, ".picker-value, .input")
        : ruleBody(src, ".input");
      expect(body, path).toContain("box-sizing: border-box");
      expect(body, path).toMatch(/min-height:\s*64rpx/);
    }
  });
});
