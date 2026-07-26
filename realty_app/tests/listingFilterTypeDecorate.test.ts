/**
 * F-LIST-01：房屋类型（二手房/新房）与装修筛选须与种子字段对齐。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import { filterListings } from "../src/local/queries";
import { getListingsByCity, setSnapshot } from "../src/local/store";
import {
  DECORATE_FILTER_OPTIONS,
  LISTING_TYPE_FILTER_OPTIONS,
  matchesListingTypeFilter
} from "../src/local/listingFilterMatch";

beforeAll(() => {
  resetSeedSnapshotCache();
  setSnapshot(buildSeedSnapshot());
});

describe("listingFilterMatch 语义", () => {
  it("二手房 / 新房 / 成交 别名", () => {
    expect(matchesListingTypeFilter("二手房", "二手房")).toBe(true);
    expect(matchesListingTypeFilter("新房", "新房")).toBe(true);
    expect(matchesListingTypeFilter("二手房", "新房")).toBe(false);
    expect(matchesListingTypeFilter("已成交", "成交")).toBe(true);
    expect(matchesListingTypeFilter("二手房", "在售")).toBe(true);
    expect(matchesListingTypeFilter("新房", "在售")).toBe(true);
  });

  it("选项常量", () => {
    expect([...DECORATE_FILTER_OPTIONS]).toEqual(["不限", "精装", "豪装", "普装", "简装", "毛坯"]);
    expect([...LISTING_TYPE_FILTER_OPTIONS]).toEqual(["全部", "二手房", "新房", "成交"]);
  });
});

describe("filterListings 二手房 / 新房 / 装修", () => {
  it("深圳同时存在二手房与新房，且筛选互斥", async () => {
    const all = getListingsByCity(2);
    const usedN = all.filter((l) => l.listingType === "二手房").length;
    const newN = all.filter((l) => l.listingType === "新房").length;
    expect(usedN).toBeGreaterThan(50);
    expect(newN).toBeGreaterThan(50);

    const used = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 40,
      filters: { listingType: "二手房" }
    });
    expect(used.total).toBe(usedN);
    expect(used.items.every((r) => r.listing_type === "二手房")).toBe(true);

    const neu = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 40,
      filters: { listingType: "新房" }
    });
    expect(neu.total).toBe(newN);
    expect(neu.items.every((r) => r.listing_type === "新房")).toBe(true);
  });

  it("选「成交」在无成交样本时可以为 0", async () => {
    const sold = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 20,
      filters: { listingType: "成交" }
    });
    expect(sold.total).toBe(0);
  });

  it("选「精装/豪装/普装/毛坯」各自应有命中", async () => {
    for (const decorate of ["精装", "豪装", "普装", "毛坯"] as const) {
      const res = await filterListings({
        cityId: 2,
        page: 1,
        pageSize: 30,
        filters: { decorateType: decorate }
      });
      expect(res.total).toBeGreaterThan(0);
      expect(res.items.every((r) => r.decorate_type === decorate)).toBe(true);
    }
  });

  it("二手房 + 精装 组合不得无故归零", async () => {
    const res = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 30,
      filters: { listingType: "二手房", decorateType: "精装" }
    });
    expect(res.total).toBeGreaterThan(0);
  });

  it("listing-filter.vue 房屋类型含二手房/新房", () => {
    const vue = readFileSync(
      resolve(process.cwd(), "src/pages/listing-filter/listing-filter.vue"),
      "utf8"
    );
    expect(vue).toContain("二手房");
    expect(vue).toContain("新房");
    expect(vue).toContain("房屋类型");
    expect(vue).toContain("豪装");
    expect(vue).toContain("emptyFilterHint");
  });
});
