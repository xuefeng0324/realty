/**
 * F-LIST-01 逻辑门禁：行政区筛选缩小命中数
 */
import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import { setSnapshot, getCommunitiesByCity, getListingsByCity } from "../src/local/store";
import { filterListings } from "../src/local/queries";

describe("listing filter districtName (F-LIST-01)", () => {
  beforeAll(() => {
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
  });

  it("选区后 total ≤ 全市，且结果小区均属该区", async () => {
    const cityId = 2;
    const all = await filterListings({
      cityId,
      page: 1,
      pageSize: 50,
      filters: {}
    } as any);
    expect(all.total).toBeGreaterThan(0);

    const districts = [
      ...new Set(
        getCommunitiesByCity(cityId)
          .map((c) => c.districtName)
          .filter((d): d is string => !!d)
      )
    ];
    expect(districts.length).toBeGreaterThan(0);
    const districtName = districts.find((d) =>
      getListingsByCity(cityId).some((l) => {
        const c = getCommunitiesByCity(cityId).find((x) => x.communityId === l.communityId);
        return c?.districtName === d;
      })
    );
    expect(districtName).toBeTruthy();

    const filtered = await filterListings({
      cityId,
      page: 1,
      pageSize: 50,
      filters: { districtName }
    } as any);

    expect(filtered.total).toBeLessThanOrEqual(all.total);
    expect(filtered.total).toBeGreaterThan(0);

    for (const item of filtered.items as any[]) {
      const listingId = item.listing_id ?? item.listingId;
      const listing = getListingsByCity(cityId).find((l) => l.listingId === listingId);
      expect(listing).toBeTruthy();
      const community = getCommunitiesByCity(cityId).find((c) => c.communityId === listing!.communityId);
      expect(community?.districtName).toBe(districtName);
    }
  });
});
