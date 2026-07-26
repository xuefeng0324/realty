import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getListingTagLabels, parseTagsJson } from "../src/local/listingTags";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalListingTag } from "../src/local/types";

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
    listingTags: [],
    listingTagSummaries: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

describe("listingTags", () => {
  it("parseTagsJson 支持数组与 JSON 字符串", () => {
    expect(parseTagsJson(["近地铁", "精装"])).toEqual(["近地铁", "精装"]);
    expect(parseTagsJson('["朝南","带电梯"]')).toEqual(["朝南", "带电梯"]);
    expect(parseTagsJson("近地铁,精装")).toEqual(["近地铁", "精装"]);
  });

  it("无 tagsJson 时回退 listing_tags 行", () => {
    const snap = emptySnapshot();
    snap.listingTags = [
      { listingId: 99, cityId: 2, districtName: "", tag: "名校区" },
      { listingId: 99, cityId: 2, districtName: "", tag: "近地铁" },
      { listingId: 1, cityId: 2, districtName: "", tag: "其他" }
    ] as LocalListingTag[];
    setSnapshot(snap);
    expect(getListingTagLabels(99, null)).toEqual(["名校区", "近地铁"]);
  });
});

describe("school.vue 重点校按城过滤", () => {
  it("源码禁止跨城汇总 dimCitySummary.reduce / Polymath(undefined)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/pages/school/school.vue"), "utf8");
    expect(src).toContain("dimCityCurrent");
    expect(src).toContain("getSchoolDimensionPolymath(app.cityId");
    expect(src).not.toMatch(/getSchoolDimensionPolymath\(undefined/);
    expect(src).not.toMatch(/dimCitySummary\.reduce/);
    expect(src).toContain("已按当前城市过滤");
  });
});
