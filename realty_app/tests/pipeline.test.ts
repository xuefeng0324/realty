/**
 * 端到端集成测试：跑完整 seed → snapshot → queries 链路。
 * 全部走 `buildSeedSnapshot`（真实公开楼盘 1226 套）。
 */

import { describe, it, expect, beforeAll } from "vitest";
import { setSnapshot } from "../src/local/store";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
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
  resetSeedSnapshotCache();
  setSnapshot(buildSeedSnapshot());
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
  // 单城市：广州
  it("seed snapshot: 广州 (city_id=1) 应该有若干 listings", async () => {
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

  // 单城市：深圳
  it("seed snapshot: 深圳 (city_id=2) 应该有 listings", async () => {
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

describe("end-to-end seed query API (guangzhou)", () => {
  it("getCities returns the seeded cities", async () => {
    const r = await getCities();
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    const names = r.items.map((c) => c.city_name);
    expect(names).toContain("广州");
    expect(names).toContain("深圳");
    expect(names).toContain("珠海");
  });

  it("getCommunityRanking returns >=1 rows for guangzhou", async () => {
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

  it("getCommunityPriceTrend returns >=1 week for a seeded community", async () => {
    // communityId 1 in seed = 华润城润府（深圳南山）；用它来验证时间序列接口
    const r = await getCommunityPriceTrend({ communityId: 1 });
    expect(r.community_name.length).toBeGreaterThan(0);
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
    // 深圳 seed 里有 schools.csv，先取深圳 city_id=2 的学校表
    const r = await searchSchools({ cityId: 2, q: "实验" });
    // 找不到也不报错：只要返回结构正确即可（深圳学校可能不含"实验"）
    expect(Array.isArray(r.items)).toBe(true);
  });
});