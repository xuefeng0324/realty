import { describe, expect, it } from "vitest";
import {
  getHospitalByCityByDistrict,
  getHospitalByCityByType,
  getHospitalCrossCityByDistrict,
  getHospitalKeyFlagByCity,
  getHospitalTopByLevelByCity,
  levelRank,
  summarizeHospitalByCity,
  summarizeHospitalByCityDistrict
} from "../src/local/hospitalRanking";
import { setSnapshot } from "../src/local/store";
import type { DataSnapshot, LocalHospital } from "../src/local/types";

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
    listingMonthlyStats: [],
    buyingGuides: []
  } as unknown as DataSnapshot;
}

function H(
  hospitalId: number,
  cityId: number,
  hospitalType: string | null,
  hospitalLevel: LocalHospital["hospitalLevel"],
  districtName: string | null,
  keyFlag: boolean | null,
  displayName: string | null = null
): LocalHospital {
  return {
    hospitalId,
    cityId,
    officialName: `Official${hospitalId}`,
    displayName,
    hospitalType,
    hospitalLevel,
    districtName,
    address: null,
    lat: null,
    lng: null,
    keyFlag
  };
}

describe("hospitalRanking", () => {
  it("levelRank 数值映射", () => {
    expect(levelRank("三甲")).toBe(4);
    expect(levelRank("三级")).toBe(3);
    expect(levelRank("二甲")).toBe(2);
    expect(levelRank("二级")).toBe(1);
    expect(levelRank("其他")).toBe(0);
    expect(levelRank(null)).toBe(-1);
  });

  it("summarizeHospitalByCity 聚合 + 三甲占比 + 类型分布", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "三甲", "福田区", true),
      H(3, 2, "中医医院", "三甲", "福田区", true),
      H(4, 2, "妇幼保健院", "三甲", "福田区", true),
      H(5, 2, "专科医院", "三级", "罗湖区", false),
      H(6, 1, "综合医院", "三甲", "天河区", true),
      H(7, 1, "综合医院", "二甲", "越秀区", false)
    ];
    setSnapshot(snap);

    const sum = summarizeHospitalByCity();
    expect(sum).toHaveLength(2);
    const sz = sum.find((s) => s.cityId === 2)!;
    expect(sz.hospitalCount).toBe(5);
    expect(sz.sanJiaCount).toBe(4); // 中医 + 妇幼 + 2 综合
    expect(sz.sanJiaShare).toBeCloseTo(0.8, 5);
    expect(sz.typeCounts["综合医院"]).toBe(2);
    expect(sz.typeCounts["中医医院"]).toBe(1);
    expect(sz.keyFlagCount).toBe(4);
    const gz = sum.find((s) => s.cityId === 1)!;
    expect(gz.hospitalCount).toBe(2);
    expect(gz.sanJiaCount).toBe(1);
  });

  it("summarizeHospitalByCityDistrict 区分排名", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "三甲", "福田区", true),
      H(3, 2, "综合医院", "三甲", "福田区", true),
      H(4, 2, "综合医院", "三甲", "福田区", true),
      H(5, 2, "综合医院", "三甲", "福田区", true),
      H(6, 2, "综合医院", "三甲", "福田区", true), // 福田 6
      H(7, 2, "综合医院", "三级", "罗湖区", false), // 罗湖 1
      H(8, 2, "综合医院", "三级", "南山区", false)  // 南山 1
    ];
    setSnapshot(snap);

    const arr = summarizeHospitalByCityDistrict(2);
    expect(arr).toHaveLength(3);
    expect(arr[0]!.districtName).toBe("福田区");
    expect(arr[0]!.hospitalCount).toBe(6);
    expect(arr[0]!.rankInCity).toBe(1);
    expect(arr[2]!.rankInCity).toBe(3);
  });

  it("getHospitalTopByLevelByCity level 排序 + keyFlag 优先", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", false),
      H(2, 2, "综合医院", "三甲", "福田区", true),
      H(3, 2, "综合医院", "三级", "罗湖区", false),
      H(4, 2, "综合医院", "二甲", "南山区", false)
    ];
    setSnapshot(snap);

    const top = getHospitalTopByLevelByCity(2, 3);
    expect(top).toHaveLength(3);
    expect(top[0]!.hospitalId).toBe(2); // 三甲 + keyFlag=true
    expect(top[1]!.hospitalId).toBe(1); // 三甲
    expect(top[2]!.hospitalId).toBe(3); // 三级
  });

  it("getHospitalByCityByType 单类型过滤", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "三甲", "福田区", true),
      H(3, 2, "中医医院", "三甲", "福田区", true),
      H(4, 2, "妇幼保健院", "三甲", "福田区", true)
    ];
    setSnapshot(snap);

    const comprehensive = getHospitalByCityByType(2, "综合医院");
    expect(comprehensive).toHaveLength(2);
    const tcm = getHospitalByCityByType(2, "中医医院");
    expect(tcm).toHaveLength(1);
    const missing = getHospitalByCityByType(2, "不存在");
    expect(missing).toEqual([]);
  });

  it("getHospitalKeyFlagByCity 重点医院", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "三甲", "福田区", false),
      H(3, 2, "综合医院", "三甲", "罗湖区", true),
      H(4, 2, "综合医院", "三甲", "福田区", null) // null ≠ true
    ];
    setSnapshot(snap);

    const keys = getHospitalKeyFlagByCity(2);
    expect(keys).toHaveLength(2);
    expect(keys.every((h) => h.keyFlag === true)).toBe(true);
  });

  it("getHospitalByCityByDistrict 单 district 全医院（按 level 倒序）", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "二甲", "福田区", false),
      H(3, 2, "综合医院", "三级", "福田区", false),
      H(4, 2, "综合医院", "三甲", "罗湖区", true)
    ];
    setSnapshot(snap);

    const futian = getHospitalByCityByDistrict(2, "福田区");
    expect(futian).toHaveLength(3);
    expect(futian[0]!.hospitalLevel).toBe("三甲");
    expect(futian[1]!.hospitalLevel).toBe("三级");
    expect(futian[2]!.hospitalLevel).toBe("二甲");

    const missing = getHospitalByCityByDistrict(2, "不存在的区");
    expect(missing).toEqual([]);
  });

  it("getHospitalCrossCityByDistrict 同名区跨城对比", () => {
    const snap = emptySnapshot();
    snap.hospitals = [
      H(1, 2, "综合医院", "三甲", "福田区", true),
      H(2, 2, "综合医院", "三甲", "福田区", true),
      H(3, 2, "综合医院", "三甲", "福田区", true),
      H(4, 1, "综合医院", "三甲", "福田区", true)
    ];
    setSnapshot(snap);

    const cross = getHospitalCrossCityByDistrict("福田区");
    expect(cross).toHaveLength(2);
    expect(cross[0]!.cityId).toBe(2); // 深圳福田 3 家
    expect(cross[0]!.hospitalCount).toBe(3);
    expect(cross[1]!.cityId).toBe(1); // 广州福田 1 家
  });

  it("空 snapshot 安全降级", () => {
    const snap = emptySnapshot();
    snap.hospitals = [];
    setSnapshot(snap);

    expect(summarizeHospitalByCity()).toEqual([]);
    expect(summarizeHospitalByCityDistrict(2)).toEqual([]);
    expect(getHospitalTopByLevelByCity(2, 5)).toEqual([]);
    expect(getHospitalByCityByType(2, "综合医院")).toEqual([]);
    expect(getHospitalKeyFlagByCity(2)).toEqual([]);
    expect(getHospitalByCityByDistrict(2, "福田区")).toEqual([]);
    expect(getHospitalCrossCityByDistrict("福田区")).toEqual([]);
  });
});