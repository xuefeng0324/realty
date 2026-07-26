import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HOME_CHANNELS,
  HOME_KINGKONG,
  HOME_SEARCH_MODES,
  homeKingkongCount,
  homeLandEntryOwner,
  homeSupplyEntryOwner,
  resolveHomeScrollAnchor,
  resolveHomeSearch,
  setPendingListingQuery,
  takePendingListingQuery
} from "../src/local/homeEntry";

describe("homeEntry F-ENTRY-01", () => {
  it("金刚区与频道数量达标", () => {
    expect(homeKingkongCount()).toBeGreaterThanOrEqual(8);
    expect(HOME_CHANNELS.length).toBeGreaterThanOrEqual(5);
    expect(HOME_SEARCH_MODES.map((m) => m.key)).toEqual(["school", "listing", "page"]);
    expect(HOME_KINGKONG.some((k) => k.label === "宏观")).toBe(true);
    expect(HOME_KINGKONG.some((k) => k.action.kind === "navigate")).toBe(true);
    expect(HOME_KINGKONG.some((k) => k.key === "inventory")).toBe(true);
    expect(HOME_KINGKONG.some((k) => k.key === "land")).toBe(true);
  });

  it("搜索路由解析", () => {
    expect(resolveHomeSearch("school", "")).toMatchObject({ kind: "none" });
    expect(resolveHomeSearch("school", "实验")).toEqual({ kind: "school", q: "实验" });
    expect(resolveHomeSearch("listing", "万科")).toEqual({
      kind: "listing",
      path: "/pages/listing-filter/listing-filter",
      q: "万科"
    });
    expect(resolveHomeSearch("listing", "").kind).toBe("listing");
    expect(resolveHomeSearch("page", "宏观").anchor).toBe("entry-macro");
    expect(resolveHomeSearch("page", "70城").anchor).toBe("entry-stats70");
    expect(resolveHomeSearch("page", "库存").anchor).toBe("entry-supply");
    expect(resolveHomeSearch("page", "xyz").kind).toBe("none");
  });

  it("库存/土地锚点按城解析，避免深圳空点", () => {
    const empty = {
      hasGzInventory: false,
      hasSzPlannedSupply: false,
      hasGzHousingPlan: false,
      hasZhAffordable: false,
      hasGzLand: false,
      hasSzLand: false
    };
    expect(resolveHomeScrollAnchor("entry-supply", empty).kind).toBe("missing");
    expect(resolveHomeScrollAnchor("entry-land", empty).kind).toBe("missing");

    const shenzhen = { ...empty, hasSzPlannedSupply: true, hasSzLand: true };
    expect(resolveHomeScrollAnchor("entry-supply", shenzhen)).toEqual({
      kind: "ok",
      id: "entry-supply"
    });
    expect(resolveHomeScrollAnchor("entry-land", shenzhen)).toEqual({
      kind: "ok",
      id: "entry-land"
    });
    expect(homeSupplyEntryOwner(shenzhen)).toBe("sz");
    expect(homeLandEntryOwner(shenzhen)).toBe("sz");

    const guangzhou = { ...empty, hasGzInventory: true, hasGzLand: true, hasSzPlannedSupply: true };
    expect(homeSupplyEntryOwner(guangzhou)).toBe("gz");
    expect(homeLandEntryOwner(guangzhou)).toBe("gz");
  });

  it("房源 pending query 可写入并取出一次", () => {
    setPendingListingQuery("  海岸城  ");
    expect(takePendingListingQuery()).toBe("海岸城");
    expect(takePendingListingQuery()).toBe("");
  });

  it("入口文案不误标成交均价", () => {
    const blob = JSON.stringify(HOME_KINGKONG) + JSON.stringify(HOME_CHANNELS);
    expect(blob).not.toMatch(/成交均价/);
  });

  it("仪表盘与学校页门禁", () => {
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("data-home-entry");
    expect(dash).toContain("data-home-search");
    expect(dash).toContain("data-home-kingkong");
    expect(dash).toContain("HOME_KINGKONG");
    expect(dash).toContain("id=\"entry-macro\"");
    expect(dash).toContain("resolveHomeScrollAnchor");
    expect(dash).toContain("supplyEntryOwner");
    expect(dash).toContain("setPendingListingQuery");
    const school = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(school).toContain("takePendingSchoolQuery");
    const listing = readFileSync(
      resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"),
      "utf8"
    );
    expect(listing).toContain("takePendingListingQuery");
    expect(listing).toContain("data-listing-keyword");
    const stats70 = readFileSync(resolve(process.cwd(), "src/pages/stats70/stats70.vue"), "utf8");
    expect(stats70).toContain("chip-btn");
    expect(stats70).not.toMatch(/class="tag tap-target"/);
    expect(stats70).not.toMatch(/class="tab tap-target"/);
    const ia = readFileSync(resolve(process.cwd(), "docs/DASHBOARD_ENTRY_IA.md"), "utf8");
    expect(ia).toContain("F-ENTRY-01");
    expect(ia).toContain("验收标准");
    expect(ia).toContain("pending listing");
  });

  it("金刚区库存点击锚点为 entry-supply（test-entry-1 门禁）", () => {
    const inv = HOME_KINGKONG.find((k) => k.key === "inventory");
    expect(inv?.action).toEqual({ kind: "scroll", anchor: "entry-supply" });
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("entry-supply");
    expect(dash).toContain("resolveHomeScrollAnchor");
    expect(dash).toContain("supplyEntryOwner");
  });
});
