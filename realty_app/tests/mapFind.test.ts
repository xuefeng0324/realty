import { describe, expect, it } from "vitest";
import {
  filterMapListings,
  formatListingCardLine,
  matchBedroomBand,
  matchPriceBand,
  nearestCommunityId,
  sortMapListingsForSheet
} from "../src/local/mapFind";

const sample = [
  {
    listingId: 1,
    communityId: 10,
    title: "A",
    totalPrice10k: 150,
    unitPrice: 30000,
    areaSqm: 50,
    bedrooms: 1
  },
  {
    listingId: 2,
    communityId: 10,
    title: "B",
    totalPrice10k: 350,
    unitPrice: 50000,
    areaSqm: 90,
    bedrooms: 3
  },
  {
    listingId: 3,
    communityId: 20,
    title: "C",
    totalPrice10k: 800,
    unitPrice: 90000,
    areaSqm: 140,
    bedrooms: 4
  }
];

describe("mapFind 找房筛选逻辑（对照贝壳）", () => {
  it("总价档匹配", () => {
    expect(matchPriceBand(150, "lt200")).toBe(true);
    expect(matchPriceBand(250, "200_400")).toBe(true);
    expect(matchPriceBand(null, "lt200")).toBe(false);
    expect(matchPriceBand(100, "all")).toBe(true);
  });

  it("户型档匹配", () => {
    expect(matchBedroomBand(1, "1")).toBe(true);
    expect(matchBedroomBand(4, "4plus")).toBe(true);
    expect(matchBedroomBand(2, "3")).toBe(false);
  });

  it("组合筛选 + 小区过滤", () => {
    const rows = filterMapListings(sample, {
      priceBand: "200_400",
      bedroomBand: "3",
      communityId: 10
    });
    expect(rows.map((r) => r.listingId)).toEqual([2]);
  });

  it("底栏排序：有价优先升序", () => {
    const sorted = sortMapListingsForSheet(sample, 10);
    expect(sorted[0].listingId).toBe(1);
    expect(sorted[1].listingId).toBe(2);
  });

  it("卡片文案含价格户型面积", () => {
    expect(formatListingCardLine(sample[1])).toContain("350万");
    expect(formatListingCardLine(sample[1])).toContain("3室");
  });

  it("最近点选小区在阈值内", () => {
    const id = nearestCommunityId(
      22.54,
      114.06,
      [
        { communityId: 1, lat: 22.541, lng: 114.061 },
        { communityId: 2, lat: 23.1, lng: 113.2 }
      ],
      1.2
    );
    expect(id).toBe(1);
  });
});
