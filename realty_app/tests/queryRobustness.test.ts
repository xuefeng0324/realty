import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import {
  getCities,
  getCityById,
  getCommunitiesByCity,
  getCommunityById,
  getDailyWangqianByCity,
  getLatestStatsForCities,
  getListingById,
  getListingsByCity,
  getListingsByCommunity,
  getStats70ByCity,
  getTopPoisByCategory,
  setDailyWangqian,
  setSnapshot,
  setStats70
} from "../src/local/store";
import {
  filterListings,
  getCommunityPriceTrend,
  getListingDetail
} from "../src/local/queries";

beforeAll(() => {
  resetSeedSnapshotCache();
  setSnapshot(buildSeedSnapshot());
});

describe("store 与 queries 鲁棒性", () => {
  it("城市索引按 cityId 隔离且能反查", () => {
    const cities = getCities();
    expect(cities.map((c) => c.cityId)).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(getCityById(1)?.cityName).toBe("广州");
    expect(getCommunitiesByCity(1).every((c) => c.cityId === 1)).toBe(true);
    expect(getListingsByCity(2).every((l) => l.cityId === 2)).toBe(true);
  });

  it("不存在的索引返回 undefined 或空数组", () => {
    expect(getCityById(99999)).toBeUndefined();
    expect(getCommunityById(99999)).toBeUndefined();
    expect(getListingById(99999)).toBeUndefined();
    expect(getCommunitiesByCity(99999)).toEqual([]);
    expect(getListingsByCommunity(99999)).toEqual([]);
  });

  it("POI 类别查询遵守 limit 且按 rank 升序", () => {
    const community = getCommunitiesByCity(2).find((c) =>
      ["subway", "school", "hospital", "mall", "park"].some(
        (category) => getTopPoisByCategory(c.communityId, category as any, 3).length > 0
      )
    );
    expect(community).toBeDefined();
    const categories = ["subway", "school", "hospital", "mall", "park"] as const;
    const category = categories.find((item) => getTopPoisByCategory(community!.communityId, item, 3).length > 0)!;
    const rows = getTopPoisByCategory(community!.communityId, category, 3);
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.every((row) => row.poiCategory === category)).toBe(true);
    expect(rows.map((row) => row.poiRank)).toEqual([...rows].map((row) => row.poiRank).sort((a, b) => a - b));
  });

  it("70城城市名兼容“市”后缀并能选择最新记录", () => {
    setStats70([
      { date: "2026/5/1", city: "广州", fixedBase: "同比", newIdx: 99, secondIdx: 98 },
      { date: "2026/6/1", city: "广州", fixedBase: "同比", newIdx: 100, secondIdx: 99 }
    ]);
    expect(getStats70ByCity("广州市")).toHaveLength(2);
    expect(getLatestStatsForCities(["广州"]).get("广州")?.date).toBe("2026/6/1");
  });

  it("网签城市名兼容“市”后缀", () => {
    setDailyWangqian([
      { date: "2026-07-01", city: "深圳", category: "新房", scope: "住宅", district: "全市", units: 10, areaSqm: 1000, granularity: "city", sourceUrl: "https://example.test" }
    ]);
    expect(getDailyWangqianByCity("深圳市")).toHaveLength(1);
    expect(getDailyWangqianByCity("广州")).toEqual([]);
  });

  it("无效房源和小区查询明确抛出 not found", async () => {
    await expect(getListingDetail(99999)).rejects.toThrow("Listing not found");
    await expect(getCommunityPriceTrend({ communityId: 99999 })).rejects.toThrow("Community not found");
  });

  it("无效城市返回空分页，页码和 pageSize 会被夹紧", async () => {
    const empty = await filterListings({ cityId: 99999, page: -3, pageSize: 1000, filters: {} });
    expect(empty.total).toBe(0);
    expect(empty.items).toEqual([]);
    expect(empty.page).toBe(1);
    expect(empty.pageSize).toBe(100);
  });

  it("价格和面积区间过滤不会返回越界记录", async () => {
    const result = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 100,
      filters: { priceRange: [200, 800], areaRange: [50, 120] }
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((row) => row.price_total >= 200 && row.price_total <= 800)).toBe(true);
    expect(result.items.every((row) => row.area_sqm >= 50 && row.area_sqm <= 120)).toBe(true);
  });

  it("朝向、装修和电梯过滤使用真实样本值", async () => {
    const sample = getListingsByCity(2).find((row) => row.orientation && row.decorateType);
    expect(sample).toBeDefined();
    const result = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 100,
      filters: {
        orientation: sample!.orientation!,
        decorateType: sample!.decorateType!,
        hasElevator: sample!.hasElevator
      }
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((row) => row.orientation === sample!.orientation)).toBe(true);
    expect(result.items.every((row) => row.decorate_type === sample!.decorateType)).toBe(true);
    expect(result.items.every((row) => row.has_elevator === sample!.hasElevator)).toBe(true);
  });

  it("升序评分、社区隔离和详情来源分级保持一致", async () => {
    const sample = getListingsByCity(2)[0];
    const result = await filterListings({
      cityId: 2,
      communityId: sample.communityId,
      page: 1,
      pageSize: 20,
      sort: { field: "overall_score", direction: "asc" },
      filters: {}
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (let index = 1; index < result.items.length; index += 1) {
      expect(result.items[index - 1].quality_score).toBeLessThanOrEqual(result.items[index].quality_score);
    }
    const communityIds = new Set(result.items.map((row) => getListingById(row.listing_id)?.communityId));
    expect([...communityIds]).toEqual([sample.communityId]);
    const detail = await getListingDetail(result.items[0].listing_id);
    expect(["REAL", "DERIVED", "ESTIMATED", "UNKNOWN"]).toContain(detail.listing.source_kind);
  });
});
