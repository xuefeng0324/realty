import { describe, expect, it } from "vitest";
import {
  getCityTagSignature,
  getTagPenetrationCompare,
  summarizeListingTagsByCity
} from "../src/local/listingTagsComparison";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot } from "../src/local/types";

function emptySnapshot(): DataSnapshot {
  return {
    importedAt: "1970-01-01T00:00:00Z",
    source: "test",
    cities: [],
    communities: [],
    districts: [],
    listings: [],
    schools: [],
    indicators: [],
    districtPolygons: [],
    metroWalks: [],
    metroLines: [],
    poiClues: [],
    climate: {
      cities: [],
      globalIndex: { source: "test", updatedAt: "1970-01-01" }
    },
    wangqianDaily: [],
    nbsRealEstate: [],
    gzNewHouseInventory: [],
    providentFundRates: [],
    educationOverview: [],
    schoolSourceAudit: [],
    communityAliasSuggestions: [],
    districtIndices: [],
    districtMeta: [],
    index70: [],
    districtTrends: [],
    schoolIndicators: [],
    schoolDimensions: [],
    listingFreshness: [],
    listingTagSummaries: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

describe("listingTagsComparison", () => {
  it("summarizeListingTagsByCity 聚合每市 topN + totalCount", () => {
    const snap = emptySnapshot();
    snap.listingTagSummaries = [
      { cityId: 1, cityName: "广州", tag: "名校区", count: 431, share: 0.1123 },
      { cityId: 1, cityName: "广州", tag: "朝南", count: 314, share: 0.0818 },
      { cityId: 1, cityName: "广州", tag: "带电梯", count: 302, share: 0.0787 },
      { cityId: 2, cityName: "深圳", tag: "名校区", count: 460, share: 0.1641 },
      { cityId: 2, cityName: "深圳", tag: "朝南", count: 446, share: 0.1591 },
      { cityId: 3, cityName: "珠海", tag: "朝南", count: 195, share: 0.0312 }
    ];
    setSnapshot(snap);

    const sum = summarizeListingTagsByCity(2);
    expect(sum).toHaveLength(3);
    // 按 cityId 升序
    expect(sum[0]!.cityId).toBe(1);
    expect(sum[1]!.cityId).toBe(2);
    expect(sum[2]!.cityId).toBe(3);

    expect(sum[0]!.cityName).toBe("广州");
    expect(sum[0]!.totalTags).toBe(3);
    expect(sum[0]!.totalCount).toBe(431 + 314 + 302);
    expect(sum[0]!.topTags).toHaveLength(2); // topN=2
    expect(sum[0]!.topTags[0]!.tag).toBe("名校区");
    expect(sum[0]!.topTags[0]!.share).toBeCloseTo(0.1123, 5);

    // 珠海只有 1 个 tag
    expect(sum[2]!.totalTags).toBe(1);
    expect(sum[2]!.topTags).toHaveLength(1);
  });

  it("getTagPenetrationCompare 按出现城市数 + avgShare 排序", () => {
    const snap = emptySnapshot();
    snap.listingTagSummaries = [
      { cityId: 1, cityName: "广州", tag: "三市共有", count: 100, share: 0.05 },
      { cityId: 2, cityName: "深圳", tag: "三市共有", count: 200, share: 0.10 },
      { cityId: 3, cityName: "珠海", tag: "三市共有", count: 50, share: 0.02 },
      { cityId: 2, cityName: "深圳", tag: "仅深圳", count: 300, share: 0.50 },
      { cityId: 1, cityName: "广州", tag: "广深有", count: 100, share: 0.05 },
      { cityId: 2, cityName: "深圳", tag: "广深有", count: 100, share: 0.10 }
    ];
    setSnapshot(snap);

    const cmp = getTagPenetrationCompare();
    expect(cmp).toHaveLength(3);

    // "三市共有" 3 城市 → 第一
    expect(cmp[0]!.tag).toBe("三市共有");
    expect(cmp[0]!.presentIn).toEqual([1, 2, 3]);
    expect(cmp[0]!.avgShare).toBeCloseTo((0.05 + 0.10 + 0.02) / 3, 5);

    // "广深有" 2 城市 → 第二
    expect(cmp[1]!.tag).toBe("广深有");
    expect(cmp[1]!.presentIn).toEqual([1, 2]);

    // "仅深圳" 1 城市 → 末位
    expect(cmp[2]!.tag).toBe("仅深圳");
    expect(cmp[2]!.presentIn).toEqual([2]);
  });

  it("getCityTagSignature 找出该市显著高的标签 (×boost)", () => {
    const snap = emptySnapshot();
    // 深圳特点
    snap.listingTagSummaries = [
      // 名校区：广 0.1123 / 深 0.1641 / 珠 0.0245
      { cityId: 1, cityName: "广州", tag: "名校区", count: 431, share: 0.1123 },
      { cityId: 2, cityName: "深圳", tag: "名校区", count: 460, share: 0.1641 },
      { cityId: 3, cityName: "珠海", tag: "名校区", count: 153, share: 0.0245 },
      // 朝南：广 0.0818 / 深 0.1591 / 珠 0.0312
      { cityId: 1, cityName: "广州", tag: "朝南", count: 314, share: 0.0818 },
      { cityId: 2, cityName: "深圳", tag: "朝南", count: 446, share: 0.1591 },
      { cityId: 3, cityName: "珠海", tag: "朝南", count: 195, share: 0.0312 }
    ];
    setSnapshot(snap);

    // boost=1.5
    // 名校区：深 0.1641 vs 其他 (0.1123+0.0245)/2 = 0.0684 → 0.1641 >= 0.0684*1.5=0.1026 ✓
    // 朝南：深 0.1591 vs (0.0818+0.0312)/2=0.0565 → 0.1591 >= 0.0565*1.5=0.0847 ✓
    const sig = getCityTagSignature(2, 1.5);
    expect(sig).toHaveLength(2);
    expect(sig[0]!.tag).toBe("名校区"); // share 0.1641 > 0.1591 → 排前
    expect(sig[1]!.tag).toBe("朝南");
    // 排序：按 share 降序
    expect(sig[0]!.share).toBeCloseTo(0.1641, 5);
    expect(sig[0]!.otherAvg).toBeCloseTo((0.1123 + 0.0245) / 2, 5);
  });

  it("getCityTagSignature 阈值 boost 越高列表越短", () => {
    const snap = emptySnapshot();
    snap.listingTagSummaries = [
      { cityId: 1, cityName: "广州", tag: "名校区", count: 100, share: 0.08 },
      { cityId: 2, cityName: "深圳", tag: "名校区", count: 200, share: 0.10 }
    ];
    setSnapshot(snap);

    // boost = 2.0：0.10 >= 0.08*2 = 0.16 ？不满足
    const strict = getCityTagSignature(2, 2.0);
    expect(strict).toEqual([]);
    // boost = 1.0：0.10 >= 0.08*1 = 0.08 → 满足
    const loose = getCityTagSignature(2, 1.0);
    expect(loose).toHaveLength(1);
    expect(loose[0]!.tag).toBe("名校区");
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.listingTagSummaries = [];
    setSnapshot(snap);

    expect(summarizeListingTagsByCity()).toEqual([]);
    expect(getTagPenetrationCompare()).toEqual([]);
    expect(getCityTagSignature(1)).toEqual([]);
  });
});
