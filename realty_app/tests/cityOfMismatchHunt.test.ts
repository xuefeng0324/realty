import { describe, it, expect, beforeAll } from "vitest";
import { buildSeedSnapshot, resetSeedSnapshotCache } from "../src/local/seedSnapshot";
import { setSnapshot, getCommunityById, getPoiCommercials } from "../src/local/store";
import {
  getPoiCommercialByCityBankCoverage,
  summarizePoiCommercialByCity
} from "../src/local/poiCommercialRanking";

/**
 * 回归：poiCommercialRanking 曾用 communityId 区间硬编码推 cityId，
 * 把深圳 1–10、珠海 19–23 错归广州，导致珠海银行覆盖率为 0、广州虚高。
 */
describe("poiCommercial cityId 与 community 一致", () => {
  beforeAll(() => {
    resetSeedSnapshotCache();
    setSnapshot(buildSeedSnapshot());
  });

  it("每条 POI 的汇总 cityId 等于 community.cityId", () => {
    const byCity = summarizePoiCommercialByCity();
    const totals = new Map(byCity.map((x) => [x.cityId, x.totalPois]));
    const real = new Map<number, number>();
    for (const p of getPoiCommercials()) {
      const c = getCommunityById(p.communityId);
      expect(c, `missing community ${p.communityId}`).toBeTruthy();
      real.set(c!.cityId, (real.get(c!.cityId) ?? 0) + 1);
    }
    for (const [cityId, n] of real) {
      expect(totals.get(cityId) ?? 0, `city ${cityId} poi count`).toBe(n);
    }
    expect(real.has(3), "珠海应有周边商业 POI").toBe(true);
    expect(byCity.some((x) => x.cityId === 3), "汇总应含珠海").toBe(true);
  });

  it("银行覆盖含珠海且覆盖率 ∈ [0,1]", () => {
    const rows = getPoiCommercialByCityBankCoverage();
    const zh = rows.find((x) => x.cityId === 3);
    expect(zh, "珠海银行覆盖行").toBeTruthy();
    expect(zh!.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(zh!.coverageRatio).toBeLessThanOrEqual(1);
    expect(zh!.totalCommunities).toBeGreaterThan(0);
  });
});
