import { describe, expect, it } from "vitest";
import {
  cityNameOf,
  classifyAdminDistrictSuffix,
  detectAdminDistrictCodeGaps,
  getAdminDistrictByCityCrossReference,
  getAdminDistrictByCityOrderedByCode,
  getAdminDistrictByNameLike,
  getAdminDistrictCrossCityByNameLike,
  summarizeAdminDistrictByCity,
  summarizeAdminDistrictBySuffix,
  summarizeAdminDistrictBySuffixType
} from "../src/local/adminDistrictRanking";
import { setSnapshot } from "../src/local/store";
import type {
  DataSnapshot,
  LocalAdminDistrict,
  LocalMetroLine
} from "../src/local/types";

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
    climate: { cities: [], globalIndex: { source: "test", updatedAt: "1970-01-01" } },
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
    poiMarkets: [],
    poiCommercials: [],
    adminDistricts: [],
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function AD(
  cityId: number,
  cityCode: string,
  districtCode: string,
  districtName: string
): LocalAdminDistrict {
  return { cityId, cityCode, districtCode, districtName };
}

function M(
  cityId: number,
  districts: string[]
): LocalMetroLine {
  return {
    lineId: 1,
    cityId,
    lineName: "mock",
    phase: "test",
    status: "在建",
    lengthKm: 10,
    stationCount: 5,
    startStation: "a",
    endStation: "b",
    maxSpeedKmh: 80,
    openYearExpected: 2028,
    districts,
    notes: null
  };
}

describe("adminDistrictRanking", () => {
  it("summarizeAdminDistrictByCity 区数 + 末 2 位 min/max/avg", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      // 广州 city 1：5 个区，末 2 位 03/05/06/13/17
      AD(1, "4401", "440103", "荔湾区"),
      AD(1, "4401", "440105", "海珠区"),
      AD(1, "4401", "440106", "天河区"),
      AD(1, "4401", "440113", "番禺区"),
      AD(1, "4401", "440117", "从化区"),
      // 深圳 city 2：3 个区
      AD(2, "4403", "440303", "罗湖区"),
      AD(2, "4403", "440305", "南山区"),
      AD(2, "4403", "440312", "大鹏新区")
    ];
    setSnapshot(snap);

    const arr = summarizeAdminDistrictByCity();
    expect(arr).toHaveLength(2);
    expect(arr[0]!.cityId).toBe(1); // 5 区 > 3 区
    expect(arr[0]!.districtCount).toBe(5);
    expect(arr[0]!.cityCode).toBe("4401");
    expect(arr[0]!.minSuffix).toBe(3);
    expect(arr[0]!.maxSuffix).toBe(17);
    expect(arr[0]!.avgSuffix).toBeCloseTo(8.8, 1); // (3+5+6+13+17)/5

    const sz = arr.find((s) => s.cityId === 2)!;
    expect(sz.districtCount).toBe(3);
    expect(sz.minSuffix).toBe(3);
    expect(sz.maxSuffix).toBe(12);
    expect(sz.avgSuffix).toBeCloseTo(6.67, 1);
  });

  it("getAdminDistrictByCityOrderedByCode 单 city districtCode 升序", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(1, "4401", "440117", "从化区"),
      AD(1, "4401", "440103", "荔湾区"),
      AD(1, "4401", "440106", "天河区")
    ];
    setSnapshot(snap);
    const arr = getAdminDistrictByCityOrderedByCode(1);
    expect(arr[0]!.districtCode).toBe("440103");
    expect(arr[1]!.districtCode).toBe("440106");
    expect(arr[2]!.districtCode).toBe("440117");
  });

  it("detectAdminDistrictCodeGaps 缺号检测（连续 vs 不连续）", () => {
    const snap = emptySnapshot();
    // 广州真实：03/04/05/06/11/12/13/14/15/17/18 → 缺 07/08/09/10/16
    snap.adminDistricts = [
      AD(1, "4401", "440103", "荔湾区"),
      AD(1, "4401", "440104", "越秀区"),
      AD(1, "4401", "440105", "海珠区"),
      AD(1, "4401", "440106", "天河区"),
      AD(1, "4401", "440113", "番禺区")
    ];
    setSnapshot(snap);
    const gap = detectAdminDistrictCodeGaps(1);
    expect(gap.actualCount).toBe(5);
    expect(gap.minSuffix).toBe(3);
    expect(gap.maxSuffix).toBe(13);
    expect(gap.rangeLength).toBe(11); // 13-3+1
    expect(gap.isContiguous).toBe(false);
    expect(gap.missingSuffixes).toEqual([7, 8, 9, 10, 11, 12]);

    // 连续场景
    snap.adminDistricts = [
      AD(1, "4401", "440101", "A"),
      AD(1, "4401", "440102", "B"),
      AD(1, "4401", "440103", "C")
    ];
    setSnapshot(snap);
    const contiguous = detectAdminDistrictCodeGaps(1);
    expect(contiguous.isContiguous).toBe(true);
    expect(contiguous.missingSuffixes).toEqual([]);
  });

  it("summarizeAdminDistrictBySuffix 同区号跨城 + cityName", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(1, "4401", "440103", "荔湾区"), // suffix=3
      AD(2, "4403", "440303", "罗湖区"), // suffix=3
      AD(3, "4404", "440403", "斗门区"), // suffix=3
      AD(1, "4401", "440106", "天河区") // suffix=6
    ];
    setSnapshot(snap);
    const arr = summarizeAdminDistrictBySuffix();
    expect(arr).toHaveLength(2);
    const s3 = arr.find((x) => x.suffix === 3)!;
    expect(s3.cities).toEqual([1, 2, 3]); // 三城都用 suffix 3
    expect(s3.cityNames).toEqual(["广州", "深圳", "珠海"]);
    expect(s3.districtNames).toHaveLength(3); // 3 行
  });

  it("getAdminDistrictByNameLike 模糊查询 + 多关键字", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(1, "4401", "440118", "增城区"),
      AD(2, "4403", "440312", "大鹏新区"),
      AD(2, "4403", "440309", "龙华区"),
      AD(3, "4404", "440403", "斗门区")
    ];
    setSnapshot(snap);
    const xinqu = getAdminDistrictByNameLike("新区");
    expect(xinqu).toHaveLength(1);
    expect(xinqu[0]!.districtName).toBe("大鹏新区");

    const all = getAdminDistrictByNameLike("区");
    expect(all).toHaveLength(4);
  });

  it("classifyAdminDistrictSuffix 4 类识别", () => {
    expect(classifyAdminDistrictSuffix(3)).toBe("主城");
    expect(classifyAdminDistrictSuffix(9)).toBe("主城");
    expect(classifyAdminDistrictSuffix(13)).toBe("郊区");
    expect(classifyAdminDistrictSuffix(19)).toBe("郊区");
    expect(classifyAdminDistrictSuffix(35)).toBe("新区");
    expect(classifyAdminDistrictSuffix(49)).toBe("新区");
    expect(classifyAdminDistrictSuffix(75)).toBe("县级市撤区");
  });

  it("summarizeAdminDistrictBySuffixType city × 类型 → 区数", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(1, "4401", "440103", "荔湾区"), // 主城
      AD(1, "4401", "440105", "海珠区"), // 主城
      AD(1, "4401", "440113", "番禺区"), // 郊区
      AD(1, "4401", "440118", "增城区"), // 郊区
      AD(1, "4401", "440115", "南沙区"), // 郊区
      AD(2, "4403", "440305", "南山区"), // 主城
      AD(2, "4403", "440312", "大鹏新区") // 新区
    ];
    setSnapshot(snap);

    const arr = summarizeAdminDistrictBySuffixType();
    const gzZhuCheng = arr.find(
      (x) => x.cityId === 1 && x.type === "主城"
    )!;
    expect(gzZhuCheng.count).toBe(2);
    const gzJiaoQu = arr.find((x) => x.cityId === 1 && x.type === "郊区")!;
    console.log("gzJiaoQu:", gzJiaoQu, "arr.length:", arr.length);
    expect(gzJiaoQu.count).toBe(3);
    const szJiaoQu = arr.find((x) => x.cityId === 2 && x.type === "郊区")!;
    expect(szJiaoQu.count).toBe(1);
  });

  it("getAdminDistrictByCityCrossReference 与 metro_planning 交叉", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(1, "4401", "440103", "荔湾区"), // 行政区登记
      AD(1, "4401", "440105", "海珠区"),
      AD(1, "4401", "440106", "天河区")
    ];
    snap.metroLines = [
      M(1, ["海珠区", "天河区", "南沙区"]) // 规划覆盖：海珠+天河+南沙
    ];
    setSnapshot(snap);

    const xref = getAdminDistrictByCityCrossReference(1);
    expect(xref.inBoth).toEqual(["海珠区", "天河区"]);
    expect(xref.onlyAdmin).toEqual(["荔湾区"]);
    expect(xref.onlyMetro).toEqual(["南沙区"]);
  });

  it("getAdminDistrictCrossCityByNameLike 同名区跨城", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [
      AD(2, "4403", "440305", "南山区"), // 深圳
      AD(1, "4401", "440105", "海珠区"), // 广州（不含"南山"）
      AD(1, "4401", "440106", "南山区") // 广州同名区
    ];
    setSnapshot(snap);
    const cross = getAdminDistrictCrossCityByNameLike("南山");
    expect(cross).toHaveLength(2); // 广州 + 深圳同名"南山区"
    expect(cross[0]!.cityId).toBe(1); // 广州先（cityId 小）
    expect(cross[1]!.cityId).toBe(2); // 深圳
  });

  it("cityNameOf 映射兜底", () => {
    expect(cityNameOf(1)).toBe("广州");
    expect(cityNameOf(2)).toBe("深圳");
    expect(cityNameOf(3)).toBe("珠海");
    expect(cityNameOf(99)).toBe("city-99"); // 兜底
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.adminDistricts = [];
    setSnapshot(snap);

    expect(summarizeAdminDistrictByCity()).toEqual([]);
    expect(getAdminDistrictByCityOrderedByCode(1)).toEqual([]);
    expect(detectAdminDistrictCodeGaps(1)).toEqual({
      cityId: 1,
      missingSuffixes: [],
      rangeLength: 0,
      actualCount: 0,
      minSuffix: 0,
      maxSuffix: 0,
      isContiguous: true
    });
    expect(summarizeAdminDistrictBySuffix()).toEqual([]);
    expect(getAdminDistrictByNameLike("区")).toEqual([]);
    expect(summarizeAdminDistrictBySuffixType()).toEqual([]);
    expect(getAdminDistrictByCityCrossReference(1)).toEqual({
      cityId: 1,
      inBoth: [],
      onlyAdmin: [],
      onlyMetro: []
    });
    expect(getAdminDistrictCrossCityByNameLike("南山")).toEqual([]);
  });
});