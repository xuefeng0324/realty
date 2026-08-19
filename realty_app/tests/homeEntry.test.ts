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

  it("频道条全部为独立页/Tab 跳转，禁止纯滚动", () => {
    for (const c of HOME_CHANNELS) {
      expect(["navigate", "switchTab", "tab", "find"]).toContain(c.action.kind);
    }
    expect(HOME_CHANNELS.find((c) => c.key === "tools")?.action).toEqual({
      kind: "navigate",
      path: "/pages/data-tools/data-tools"
    });
    expect(HOME_CHANNELS.find((c) => c.key === "supply")?.action).toEqual({
      kind: "navigate",
      path: "/pages/supply/supply"
    });
    expect(HOME_CHANNELS.find((c) => c.key === "macro")?.action).toEqual({
      kind: "navigate",
      path: "/pages/macro-region/macro-region"
    });
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
    expect(resolveHomeSearch("page", "宏观")).toMatchObject({
      kind: "navigate",
      path: "/pages/macro-region/macro-region"
    });
    expect(resolveHomeSearch("page", "70城")).toMatchObject({
      kind: "navigate",
      path: "/pages/stats70/stats70"
    });
    expect(resolveHomeSearch("page", "库存")).toMatchObject({
      kind: "navigate",
      path: "/pages/supply/supply?focus=inventory"
    });
    expect(resolveHomeSearch("page", "工具")).toMatchObject({
      kind: "navigate",
      path: "/pages/data-tools/data-tools"
    });
    expect(resolveHomeSearch("page", "xyz").kind).toBe("none");
  });

  it("库存/土地锚点按城解析，避免深圳空点", () => {
    const empty = {
      hasGzInventory: false,
      hasSzPlannedSupply: false,
      hasGzHousingPlan: false,
      hasZhAffordable: false,
      hasZhBdcRegistration: false,
      hasDailyWangqian: false,
      hasGzLand: false,
      hasSzLand: false
    };
    expect(resolveHomeScrollAnchor("entry-supply", empty).kind).toBe("missing");
    expect(resolveHomeScrollAnchor("entry-land", empty).kind).toBe("missing");

    const shenzhen = { ...empty, hasSzPlannedSupply: true, hasSzLand: true, hasDailyWangqian: true };
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

  it("珠海网签锚点落到不动产登记季报，不空跳", () => {
    const zh = {
      hasGzInventory: false,
      hasSzPlannedSupply: false,
      hasGzHousingPlan: false,
      hasZhAffordable: true,
      hasZhBdcRegistration: true,
      hasDailyWangqian: false,
      hasGzLand: false,
      hasSzLand: false
    };
    expect(resolveHomeScrollAnchor("overview-wangqian", zh)).toEqual({
      kind: "ok",
      id: "entry-zh-bdc-registration"
    });
    const sz = { ...zh, hasDailyWangqian: true, hasZhBdcRegistration: false };
    expect(resolveHomeScrollAnchor("overview-wangqian", sz)).toEqual({
      kind: "ok",
      id: "overview-wangqian"
    });
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
    expect(dash).toContain("onHomeChannel");
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
    const supply = readFileSync(resolve(process.cwd(), "src/pages/supply/supply.vue"), "utf8");
    expect(supply).toContain("data-supply-header");
    expect(supply).toContain("data-supply-inventory");
    expect(supply).toContain("data-supply-land");
    const pages = readFileSync(resolve(process.cwd(), "src/pages.json"), "utf8");
    expect(pages).toContain("pages/supply/supply");
    const ia = readFileSync(resolve(process.cwd(), "docs/DASHBOARD_ENTRY_IA.md"), "utf8");
    expect(ia).toContain("F-ENTRY-01");
    expect(ia).toContain("验收标准");
    expect(ia).toContain("pending listing");
    expect(ia).toContain("独立页");
  });

  it("金刚区库存/土地点击跳供需独立页（非本页滚动）", () => {
    const inv = HOME_KINGKONG.find((k) => k.key === "inventory");
    expect(inv?.action).toEqual({
      kind: "navigate",
      path: "/pages/supply/supply?focus=inventory"
    });
    const land = HOME_KINGKONG.find((k) => k.key === "land");
    expect(land?.action).toEqual({
      kind: "navigate",
      path: "/pages/supply/supply?focus=land"
    });
    const dash = readFileSync(resolve(process.cwd(), "src/pages/dashboard/dashboard.vue"), "utf8");
    expect(dash).toContain("onHomeChannel");
    expect(dash).toContain("onHomeKingkong");
    const smoke = readFileSync(resolve(process.cwd(), "tests/e2e/smoke_entry_supply.mjs"), "utf8");
    expect(smoke).toContain("pages/supply/supply");
    expect(smoke).toContain("库存");
  });
});
