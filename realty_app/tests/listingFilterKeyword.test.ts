/**
 * F-LIST-01：关键字筛选（标题 / 小区名 / 行政区）缩小命中数
 */
import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import { setSnapshot, getCommunitiesByCity, getListingsByCity } from "../src/local/store";
import { filterListings } from "../src/local/queries";

describe("listing filter keyword (F-LIST-01)", () => {
  beforeAll(() => {
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
  });

  it("关键字命中数 ≤ 全市，且标题或小区含关键字", async () => {
    const cityId = 2;
    const all = await filterListings({
      cityId,
      page: 1,
      pageSize: 50,
      filters: {}
    } as any);
    expect(all.total).toBeGreaterThan(0);

    const sample = getListingsByCity(cityId)[0];
    expect(sample).toBeTruthy();
    const community = getCommunitiesByCity(cityId).find((c) => c.communityId === sample.communityId);
    const keyword = (community?.communityName || sample.title).slice(0, 2);
    expect(keyword.length).toBeGreaterThan(0);

    const filtered = await filterListings({
      cityId,
      page: 1,
      pageSize: 50,
      filters: { keyword }
    } as any);

    expect(filtered.total).toBeLessThanOrEqual(all.total);
    expect(filtered.total).toBeGreaterThan(0);
    const q = keyword.toLowerCase();
    for (const it of filtered.items) {
      const hitTitle = it.title.toLowerCase().includes(q);
      const listing = getListingsByCity(cityId).find((l) => l.listingId === it.listing_id);
      const c = listing
        ? getCommunitiesByCity(cityId).find((x) => x.communityId === listing.communityId)
        : undefined;
      const hitCommunity = !!c?.communityName?.toLowerCase().includes(q);
      const hitDistrict = !!c?.districtName?.toLowerCase().includes(q);
      expect(hitTitle || hitCommunity || hitDistrict).toBe(true);
    }
  });

  it("无匹配关键字 total 为 0", async () => {
    const filtered = await filterListings({
      cityId: 2,
      page: 1,
      pageSize: 20,
      filters: { keyword: "__no_such_listing_kw_xyz__" }
    } as any);
    expect(filtered.total).toBe(0);
    expect(filtered.items).toEqual([]);
  });
});
