import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
}));

vi.mock("../src/api/http", () => mocks);

import { getQualitySummary, getTopTags } from "../src/api/communities";
import { filterListings, getListingDetail } from "../src/api/listings";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../src/api/meta";
import { getSchoolFutureScore, searchSchools } from "../src/api/schools";
import {
  getCommunityPriceTrend,
  getCommunityPriceTrendFiltered,
  getCommunityRanking,
  getDistrictCompare
} from "../src/api/stats";

beforeEach(() => {
  mocks.apiGet.mockReset().mockResolvedValue({});
  mocks.apiPost.mockReset().mockResolvedValue({});
});

describe("API薄封装参数契约", () => {
  it("小区质量接口补齐默认参数", async () => {
    await getQualitySummary({ communityId: 12 });
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/v1/communities/12/quality-summary", {
      days: 30,
      periodType: "weekly",
      includeRadar: false
    });
    await getTopTags({ communityId: 12 });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/communities/12/top-tags", { limit: 20 });
  });

  it("房源筛选原样POST，详情只在有weekEnd时附带参数", async () => {
    const body = { cityId: 2, page: 1, pageSize: 20, filters: {} } as any;
    await filterListings(body);
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/v1/listings/filter", body);
    await getListingDetail(9);
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/listings/9", undefined);
    await getListingDetail(9, "2026-07-12");
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/listings/9", { weekEnd: "2026-07-12" });
  });

  it("元数据接口路径稳定且period默认limit=20", async () => {
    await getCities();
    await getRuntimeMeta();
    expect(mocks.apiGet.mock.calls[0]).toEqual(["/api/v1/cities"]);
    expect(mocks.apiGet.mock.calls[1]).toEqual(["/api/v1/runtime"]);
    await getPeriods({ type: "weekly", cityId: 2 });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/periods", { type: "weekly", cityId: 2, limit: 20 });
  });

  it("来源与覆盖率接口透传cityId和source", async () => {
    await getSources({ cityId: 2 });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/sources", { cityId: 2 });
    await getCoverage({ cityId: 2, source: "链家在售" });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/coverage", { cityId: 2, source: "链家在售" });
  });

  it("学校搜索和未来评分使用正确路径", async () => {
    await searchSchools({ cityId: 1, q: "实验" });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/schools/search", { cityId: 1, q: "实验" });
    await getSchoolFutureScore({ schoolId: 7, ruleVersion: "v2" });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/schools/7/future-score", { ruleVersion: "v2" });
  });

  it("社区排行与行政区对比完整透传参数", async () => {
    const ranking = { cityId: 1, periodType: "weekly", weekEnd: "2026-07-12", metric: "avg_unit_price" } as const;
    await getCommunityRanking(ranking);
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/stats/community-ranking", ranking);
    const district = { cityId: 1, periodType: "weekly", weekEnd: "2026-07-12" } as const;
    await getDistrictCompare(district);
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/stats/district-compare", district);
  });

  it("价格趋势把communityId放进路径而不重复放查询参数", async () => {
    await getCommunityPriceTrend({ communityId: 23, periodType: "weekly", weekEnd: "2026-07-12" });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/communities/23/price-trend", {
      periodType: "weekly",
      weekEnd: "2026-07-12"
    });
  });

  it("过滤趋势保留质量分和房源类型参数", async () => {
    await getCommunityPriceTrendFiltered({
      communityId: 23,
      periodType: "weekly",
      weekEnd: "2026-07-12",
      minQualityScore: 60,
      maxQualityScore: 90,
      listingType: "二手"
    });
    expect(mocks.apiGet).toHaveBeenLastCalledWith("/api/v1/communities/23/price-trend-filtered", {
      periodType: "weekly",
      weekEnd: "2026-07-12",
      minQualityScore: 60,
      maxQualityScore: 90,
      listingType: "二手"
    });
  });
});
