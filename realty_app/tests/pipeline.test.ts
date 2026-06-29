/**
 * 端到端集成测试：跑完整 demo → snapshot → queries 链路。
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setSnapshot } from "../src/local/store";
import { buildDemoSnapshot } from "../src/local/demoData";
import {
  getCities,
  getPeriods,
  getCommunityRanking,
  getDistrictCompare,
  getCommunityPriceTrend,
  getQualitySummary,
  getTopTags,
  filterListings,
  getListingDetail,
  searchSchools
} from "../src/local/queries";

beforeAll(() => {
  setSnapshot(buildDemoSnapshot("TestCity"));
});

describe("end-to-end seed snapshot queries", () => {
  it("seed snapshot: 广州 (city_id=1) 应该有若干 listings", async () => {
    const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
    const cities = await getCities();
    expect(cities.items.length).toBeGreaterThanOrEqual(3);
    const gz = cities.items.find((c) => c.city_id === 1);
    expect(gz?.city_name).toBe("广州");

    const periods = await getPeriods({ cityId: 1 });
    console.log("[seed pipe] 广州 periods count =", periods.items.length);
    expect(periods.items.length).toBeGreaterThan(0);
    const latest = periods.items[periods.items.length - 1];
    console.log("[seed pipe] 广州 latest weekEnd =", latest);

    const r = await getCommunityRanking({
      cityId: 1, weekEnd: latest, metric: "avg_unit_price", top: 20, page: 1, pageSize: 20,
    });
    console.log("[seed pipe] 广州 ranking length =", r.data.length);
    expect(r.data.length).toBeGreaterThan(0);

    const d = await getDistrictCompare({ cityId: 1, weekEnd: latest });
    console.log("[seed pipe] 广州 districts length =", d.items.length);
    expect(d.items.length).toBeGreaterThan(0);
  });

  it("seed snapshot: 深圳 (city_id=2) 应该有 listings", async () => {
    const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
    const periods = await getPeriods({ cityId: 2 });
    const latest = periods.items[periods.items.length - 1];
    const r = await getCommunityRanking({
      cityId: 2, weekEnd: latest, metric: "avg_unit_price", top: 20, page: 1, pageSize: 20,
    });
    console.log("[seed pipe] 深圳 ranking length =", r.data.length);
    expect(r.data.length).toBeGreaterThan(0);

    const d = await getDistrictCompare({ cityId: 2, weekEnd: latest });
    console.log("[seed pipe] 深圳 districts length =", d.items.length);
    expect(d.items.length).toBeGreaterThan(0);
  });
});

describe("end-to-end seed snapshot queries", () => {
  it("seed snapshot: 广州 (city_id=1) 应该有若干 listings", async () => {
    const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
    const cities = await getCities();
    expect(cities.items.length).toBeGreaterThanOrEqual(3);
    const gz = cities.items.find((c) => c.city_id === 1);
    expect(gz?.city_name).toBe("广州");

    const periods = await getPeriods({ cityId: 1 });
    console.log("[seed pipe] 广州 periods count =", periods.items.length);
    expect(periods.items.length).toBeGreaterThan(0);
    const latest = periods.items[periods.items.length - 1];
    console.log("[seed pipe] 广州 latest weekEnd =", latest);

    const r = await getCommunityRanking({
      cityId: 1, weekEnd: latest, metric: "avg_unit_price", top: 20, page: 1, pageSize: 20,
    });
    console.log("[seed pipe] 广州 ranking length =", r.data.length);
    expect(r.data.length).toBeGreaterThan(0);

    const d = await getDistrictCompare({ cityId: 1, weekEnd: latest });
    console.log("[seed pipe] 广州 districts length =", d.items.length);
    expect(d.items.length).toBeGreaterThan(0);
  });

  it("seed snapshot: 深圳 (city_id=2) 应该有 listings", async () => {
    const { buildSeedSnapshot, resetSeedSnapshotCache } = await import("../src/local/seedSnapshot");
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
    const periods = await getPeriods({ cityId: 2 });
    const latest = periods.items[periods.items.length - 1];
    const r = await getCommunityRanking({
      cityId: 2, weekEnd: latest, metric: "avg_unit_price", top: 20, page: 1, pageSize: 20,
    });
    console.log("[seed pipe] 深圳 ranking length =", r.data.length);
    expect(r.data.length).toBeGreaterThan(0);

    const d = await getDistrictCompare({ cityId: 2, weekEnd: latest });
    console.log("[seed pipe] 深圳 districts length =", d.items.length);
    expect(d.items.length).toBeGreaterThan(0);
  });
});

describe("end-to-end demo queries", () => {
  // 每次都重置为 demo，避免被其他测试 setSnapshot 污染
  beforeEach(() => {
    setSnapshot(buildDemoSnapshot("TestCity"));
  });

  it("getCities returns one city", async () => {
    const r = await getCities();
    expect(r.items).toHaveLength(1);
    expect(r.items[0].city_name).toBe("TestCity");
  });

  it("getCommunityRanking returns >=1 rows", async () => {
    const periods = await getPeriods({ cityId: 1 });
    const weekEnd = periods.items[periods.items.length - 1];
    const r = await getCommunityRanking({ cityId: 1, weekEnd, metric: "avg_unit_price" });
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.data[0].rank).toBe(1);
  });

  it("getDistrictCompare buckets by district", async () => {
    const periods = await getPeriods({ cityId: 1 });
    const weekEnd = periods.items[periods.items.length - 1];
    const r = await getDistrictCompare({ cityId: 1, weekEnd });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((it) => it.district_name.length > 0)).toBe(true);
  });

  it("getCommunityPriceTrend returns >=1 week", async () => {
    const r = await getCommunityPriceTrend({ communityId: 1 });
    expect(r.community_name).toBe("星河湾");
    expect(r.data.length).toBeGreaterThan(0);
  });

  it("getQualitySummary computes bins", async () => {
    const r = await getQualitySummary({ communityId: 1, includeRadar: true });
    expect(r.bins.length).toBe(4);
    expect(r.rule_version).toBe("listing_quality_score_v1");
    expect(r.radar).not.toBeNull();
  });

  it("getTopTags returns top advantages/disadvantages", async () => {
    const r = await getTopTags({ communityId: 1, limit: 5 });
    expect(r).toHaveProperty("advantages");
    expect(r).toHaveProperty("disadvantages");
  });

  it("filterListings returns paginated results with scores", async () => {
    const r = await filterListings({
      cityId: 1,
      page: 1,
      pageSize: 10,
      filters: {}
    });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].quality_score).toBeGreaterThan(0);
    // sorted desc by score
    for (let i = 1; i < r.items.length; i++) {
      expect(r.items[i - 1].quality_score).toBeGreaterThanOrEqual(r.items[i].quality_score);
    }
  });

  it("getListingDetail returns explain_json", async () => {
    const list = await filterListings({ cityId: 1, page: 1, pageSize: 1, filters: {} });
    const id = list.items[0].listing_id;
    const r = await getListingDetail(id);
    expect(r.listing.listing_id).toBe(id);
    expect(r.score.explain_json.dimension_scores).toBeDefined();
    expect(r.score.explain_json.inputs_snapshot).toBeDefined();
  });

  it("searchSchools finds by keyword", async () => {
    const r = await searchSchools({ cityId: 1, q: "实验" });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].official_name).toContain("实验");
  });
});